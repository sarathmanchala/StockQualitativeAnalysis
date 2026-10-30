import os
import uuid
import logging
from django.http import HttpResponse, Http404, FileResponse
from django.db.models import Q
from django.contrib.auth import authenticate, login, logout
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.authtoken.models import Token

from .models import (
    InvestmentPrinciple, 
    ResearchReport, 
    CompanyResearchReport, 
    ReportSection,
    SavedCompany,
    ResearchActivity,
)
from .serializers import (
    InvestmentPrincipleSerializer,
    PrincipleUpdateSerializer,
    AnalyzeRequestSerializer,
    AskRequestSerializer,
    CompareRequestSerializer,
    ResearchReportListSerializer,
    ResearchReportDetailSerializer,
    GenerateReportRequestSerializer,
    SavedCompanySerializer,
    SavedCompanyCreateSerializer,
    ResearchActivitySerializer,
    UserProfileSerializer,
    LoginRequestSerializer,
    RegisterRequestSerializer,
)
from .services.company_data import fetch_company_data, FinancialDataError
from .services.financial_metrics import calculate_metrics
from .services.investment_principles import evaluate_principles
from .services.ai_research import (
    generate_research_report,
    answer_financial_question,
    generate_comparison_report
)
from .services.comprehensive_report import generate_comprehensive_report
from .services.report_generator import InstitutionalReportGenerator

logger = logging.getLogger(__name__)

class CompanyDetailView(APIView):
    """Fetches normalized company financial profile, statements, and price history."""
    def get(self, request, ticker):
        ticker_clean = ticker.strip().upper()
        try:
            company_data = fetch_company_data(ticker_clean)
            return Response(company_data.model_dump())
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error fetching company {ticker}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PrincipleListView(APIView):
    """Retrieves all configured investment principles."""
    def get(self, request):
        principles = InvestmentPrinciple.objects.all()
        serializer = InvestmentPrincipleSerializer(principles, many=True)
        return Response(serializer.data)

class PrincipleDetailView(APIView):
    """Updates the evaluation threshold for a specific investment principle."""
    def put(self, request, identifier):
        try:
            principle = InvestmentPrinciple.objects.get(identifier=identifier)
        except InvestmentPrinciple.DoesNotExist:
            return Response({"detail": "Principle not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = PrincipleUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        principle.threshold = serializer.validated_data['threshold']
        principle.save()
        return Response({"status": "success", "threshold": principle.threshold})

class AnalyzeView(APIView):
    """Runs complete single-company investment analysis pipeline."""

    def _execute_analysis(self, ticker: str, user):
        company_data = fetch_company_data(ticker)
        metrics_result = calculate_metrics(company_data)
        metrics_dict = metrics_result.metrics.model_dump()
        principles = list(InvestmentPrinciple.objects.all())
        if not principles:
            try:
                from api.apps import DEFAULT_PRINCIPLES
                for p in DEFAULT_PRINCIPLES:
                    InvestmentPrinciple.objects.get_or_create(identifier=p["identifier"], defaults=p)
                principles = list(InvestmentPrinciple.objects.all())
            except Exception as seed_err:
                logger.warning(f"Failed to auto-seed principles: {seed_err}")
        evaluation_report = evaluate_principles(metrics_dict, principles)

        ai_report_dict = generate_research_report(
            company_data, metrics_dict, evaluation_report.model_dump()
        )

        # Record quantitative research activity if user is authenticated
        if user and user.is_authenticated:
            try:
                ResearchActivity.objects.create(
                    user=user,
                    ticker=ticker,
                    company_name=company_data.profile.name or ticker,
                    research_type="quantitative",
                    status="completed",
                    summary_data={
                        "current_price": company_data.profile.current_price,
                        "roe": metrics_dict.get("roe"),
                        "pe_ratio": metrics_dict.get("pe_ratio"),
                        "principles_passed": evaluation_report.passed_count,
                        "principles_total": evaluation_report.total_count,
                    }
                )
            except Exception as act_err:
                logger.warning(f"Could not log quantitative research activity for {ticker}: {act_err}")

        return Response({
            "company_data": company_data.model_dump(),
            "metrics": metrics_result.model_dump(),
            "evaluation": evaluation_report.model_dump(),
            "ai_report": ai_report_dict
        })

    def get(self, request):
        ticker = (request.query_params.get("ticker") or "").strip().upper()
        if not ticker:
            return Response({
                "message": "Analyze endpoint. Send a POST request with JSON body {\"ticker\": \"AAPL\"} or GET with query parameter ?ticker=AAPL.",
                "methods": ["POST", "GET"],
                "example": "/api/analyze?ticker=AAPL"
            }, status=status.HTTP_200_OK)

        try:
            return self._execute_analysis(ticker, request.user)
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error analyzing {ticker}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        serializer = AnalyzeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Ticker cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        ticker = serializer.validated_data['ticker'].strip().upper()
        if not ticker:
            return Response({"detail": "Ticker cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            return self._execute_analysis(ticker, request.user)
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error analyzing {ticker}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AskView(APIView):
    """Processes interactive Q&A utilizing bounded application context."""
    def get(self, request):
        return Response({
            "message": "Interactive Q&A endpoint. Send a POST request with JSON body {\"question\": \"...\", \"context\": {...}}.",
            "method": "POST"
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AskRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Question and context are required."}, status=status.HTTP_400_BAD_REQUEST)

        question = serializer.validated_data['question'].strip()
        context = serializer.validated_data['context']
        if not question:
            return Response({"detail": "Question cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ans = answer_financial_question(context, question)
            return Response({"answer": ans})
        except Exception as e:
            logger.error(f"Error answering question: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CompareView(APIView):
    """Executes a full pipeline analysis on two tickers for a head-to-head comparison."""
    def get(self, request):
        return Response({
            "message": "Head-to-head comparison endpoint. Send a POST request with JSON body {\"tickers\": [\"TICKER1\", \"TICKER2\"]}.",
            "method": "POST"
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CompareRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Exactly 2 tickers are required for comparison."}, status=status.HTTP_400_BAD_REQUEST)

        tickers = serializer.validated_data['tickers']
        if len(tickers) != 2:
            return Response({"detail": "Exactly 2 tickers are required for comparison."}, status=status.HTTP_400_BAD_REQUEST)

        principles = list(InvestmentPrinciple.objects.all())
        companies = []
        contexts = []

        try:
            for t in tickers:
                t_clean = t.strip().upper()
                c_data = fetch_company_data(t_clean)
                c_metrics = calculate_metrics(c_data)
                c_evals = evaluate_principles(c_metrics.metrics.model_dump(), principles)

                companies.append({
                    "ticker": t_clean,
                    "metrics": c_metrics.metrics.model_dump(),
                    "evaluations": c_evals.model_dump()
                })
                contexts.append({
                    "profile": c_data.profile.model_dump(),
                    "metrics": c_metrics.metrics.model_dump(),
                    "evaluations": c_evals.model_dump()
                })

            ai_comp = generate_comparison_report(contexts[0], contexts[1])
            return Response({
                "companies": companies,
                "ai_comparison": ai_comp
            })
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error comparing {tickers}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ComprehensiveReportView(APIView):
    """Legacy endpoint returning quick synthesized report dictionary."""
    def post(self, request):
        serializer = AnalyzeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Ticker cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        ticker = serializer.validated_data['ticker'].strip().upper()
        if not ticker:
            return Response({"detail": "Ticker cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            report = generate_comprehensive_report(ticker)
            return Response(report)
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error generating comprehensive report for {ticker}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request, ticker):
        ticker_clean = ticker.strip().upper()
        try:
            report = generate_comprehensive_report(ticker_clean)
            return Response(report)
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error generating comprehensive report for {ticker_clean}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------------------------------------------------
# 15-Section Persistent Research Report Endpoints
# -------------------------------------------------------------

def get_user_report_or_404(report_id, user):
    """
    Safely retrieves a research report strictly isolated to the authenticated user.
    Supports either UUID string (report_id) or database integer primary key.
    Raises Http404 if not found or if the report belongs to another user.
    """
    qs = ResearchReport.objects.filter(user=user)

    # 1. Try UUID string match
    try:
        val = uuid.UUID(str(report_id))
        report = qs.filter(report_id=val).first()
        if report:
            return report
    except (ValueError, TypeError, AttributeError):
        pass

    # 2. Try integer primary key match
    if str(report_id).isdigit():
        report = qs.filter(id=int(report_id)).first()
        if report:
            return report

    raise Http404("Research report not found.")


class ReportListCreateView(APIView):
    """
    Lists research reports owned by the authenticated user (with pagination and filtering)
    or initiates generation of a new 15-section institutional dossier.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ResearchReport.objects.filter(user=request.user).order_by("-generation_date")

        ticker = request.query_params.get("ticker")
        if ticker:
            qs = qs.filter(ticker__iexact=ticker.strip())

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status__iexact=status_param.strip())

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        if page is not None:
            serializer = ResearchReportListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = ResearchReportListSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = GenerateReportRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ticker = serializer.validated_data["ticker"].strip().upper()
        report_title = serializer.validated_data.get("report_title") or None

        try:
            generator = InstitutionalReportGenerator(
                ticker=ticker,
                user=request.user,
                report_title=report_title
            )
            report = generator.generate()
            detail_serializer = ResearchReportDetailSerializer(report)
            return Response(detail_serializer.data, status=status.HTTP_201_CREATED)
        except FinancialDataError as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in ReportListCreateView for {ticker}: {e}", exc_info=True)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportDetailView(APIView):
    """
    Retrieves complete 15-section report details or deletes an owned report.
    Guarantees strict ownership isolation (returns 404 for other users' reports).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_user_report_or_404(report_id, request.user)
        serializer = ResearchReportDetailSerializer(report)
        return Response(serializer.data)

    def delete(self, request, report_id):
        report = get_user_report_or_404(report_id, request.user)

        # Remove private PDF file if present on disk
        if report.private_file_path and os.path.exists(report.private_file_path):
            try:
                os.remove(report.private_file_path)
            except OSError as err:
                logger.warning(f"Could not remove PDF file {report.private_file_path}: {err}")

        report.delete()
        return Response({"status": "deleted"}, status=status.HTTP_204_NO_CONTENT)


class ReportStatusView(APIView):
    """
    Checks real-time generation status and execution metadata of an owned report.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_user_report_or_404(report_id, request.user)
        return Response({
            "report_id": str(report.report_id),
            "id": report.id,
            "ticker": report.ticker,
            "company_name": report.company_name,
            "report_title": report.report_title,
            "status": report.status,
            "page_count": report.page_count,
            "page_limit": report.page_limit,
            "error_details": report.error_details,
            "generation_date": report.generation_date,
            "execution_time_seconds": report.execution_time_seconds,
            "conviction_rating": report.conviction_rating,
        })


class ReportDownloadView(APIView):
    """
    Streams the verified private PDF report to the authenticated owner.
    Guarantees that files are not exposed through unrestricted public URLs.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_user_report_or_404(report_id, request.user)

        if report.status != "completed":
            return Response(
                {"detail": f"Report generation is not completed yet (current status: {report.status})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not report.private_file_path or not os.path.exists(report.private_file_path):
            return Response(
                {"detail": "Report PDF file not found in private storage."},
                status=status.HTTP_404_NOT_FOUND
            )

        return FileResponse(
            open(report.private_file_path, "rb"),
            content_type="application/pdf",
            as_attachment=True,
            filename=f"{report.ticker}_Institutional_Report.pdf"
        )


class ReportHtmlView(APIView):
    """Renders print-ready HTML with @page pagination rules for the authenticated owner."""
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_user_report_or_404(report_id, request.user)
        return HttpResponse(
            report.html_content or "<h1>Report Content Pending</h1>",
            content_type="text/html; charset=utf-8"
        )


class ReportMarkdownView(APIView):
    """Downloads formatted Markdown version of the 15-section research report for the owner."""
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_user_report_or_404(report_id, request.user)
        response = HttpResponse(report.markdown_content or "", content_type="text/markdown; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{report.ticker}_Institutional_Report.md"'
        return response


class UserSubscriptionStatusView(APIView):
    """
    Returns the actual subscription status and plan entitlement of the user.
    """
    @classmethod
    def get_subscription_payload(cls, user):
        is_authenticated = user.is_authenticated if user else False

        if is_authenticated and (user.is_staff or user.is_superuser):
            tier = "premium"
            tier_name = "Enterprise Institutional"
        elif is_authenticated:
            tier = "free"
            tier_name = "Standard Analyst (Free Tier)"
        else:
            tier = "guest"
            tier_name = "Guest Visitor"

        return {
            "is_authenticated": is_authenticated,
            "username": user.username if is_authenticated else "Anonymous Analyst",
            "tier": tier,
            "tier_name": tier_name,
            "subscription_active": True if is_authenticated else False,
            "payment_gateway_status": "not_integrated",
            "limits": {
                "max_pdf_pages": 50,
                "reports_per_day": "Unlimited" if tier == "premium" else "5 reports/day",
            },
            "features": {
                "quantitative_valuation": True,
                "qualitative_filings_rag": True,
                "dcf_valuation_engine": True,
                "pdf_generation_50_pages": True,
                "custom_wacc_discounting": True if tier == "premium" else False,
                "batch_peer_exports": True if tier == "premium" else False,
                "dedicated_api_access": True if tier == "premium" else False,
            }
        }

    def get(self, request):
        return Response(self.get_subscription_payload(request.user))


# -------------------------------------------------------------
# Saved Companies / Watchlist Endpoints (Prompt 6)
# -------------------------------------------------------------

class WatchlistListCreateView(APIView):
    """
    Retrieves the authenticated user's saved company watchlist or adds a company.
    Enforces user isolation and duplicate prevention at both database and view layers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SavedCompany.objects.filter(user=request.user).order_by("-added_at")
        query = request.query_params.get("query")
        if query:
            q_clean = query.strip()
            qs = qs.filter(
                Q(ticker__icontains=q_clean) | Q(company_name__icontains=q_clean)
            )

        serializer = SavedCompanySerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SavedCompanyCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ticker = serializer.validated_data["ticker"].strip().upper()
        company_name = serializer.validated_data.get("company_name", "").strip() or ticker
        sector = serializer.validated_data.get("sector", "").strip()
        notes = serializer.validated_data.get("notes", "").strip()

        # Check for duplicate
        if SavedCompany.objects.filter(user=request.user, ticker=ticker).exists():
            return Response(
                {"detail": f"Company {ticker} is already in your saved watchlist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        saved_item = SavedCompany.objects.create(
            user=request.user,
            ticker=ticker,
            company_name=company_name,
            sector=sector,
            notes=notes,
        )
        return Response(SavedCompanySerializer(saved_item).data, status=status.HTTP_201_CREATED)


class WatchlistDetailView(APIView):
    """
    Retrieves or deletes a specific company from the authenticated user's watchlist.
    """
    permission_classes = [IsAuthenticated]

    def _get_item(self, identifier, user):
        qs = SavedCompany.objects.filter(user=user)
        # Try match by ticker
        item = qs.filter(ticker__iexact=str(identifier).strip()).first()
        if not item and str(identifier).isdigit():
            item = qs.filter(id=int(identifier)).first()
        if not item:
            raise Http404("Saved company not found in your watchlist.")
        return item

    def get(self, request, identifier):
        item = self._get_item(identifier, request.user)
        return Response(SavedCompanySerializer(item).data)

    def delete(self, request, identifier):
        item = self._get_item(identifier, request.user)
        item.delete()
        return Response({"status": "removed"}, status=status.HTTP_204_NO_CONTENT)


class WatchlistCheckView(APIView):
    """
    Checks if a specific ticker is present in the authenticated user's watchlist.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ticker = request.query_params.get("ticker", "").strip().upper()
        if not ticker:
            return Response({"detail": "Ticker query parameter required."}, status=status.HTTP_400_BAD_REQUEST)

        is_saved = SavedCompany.objects.filter(user=request.user, ticker=ticker).exists()
        return Response({"ticker": ticker, "is_saved": is_saved})


# -------------------------------------------------------------
# Research Activity / History Endpoints (Prompt 6)
# -------------------------------------------------------------

class ResearchHistoryListView(APIView):
    """
    Lists research activities (quantitative, qualitative, report) conducted by the user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ResearchActivity.objects.filter(user=request.user).order_by("-created_at")

        ticker = request.query_params.get("ticker")
        if ticker:
            qs = qs.filter(ticker__iexact=ticker.strip())

        research_type = request.query_params.get("research_type")
        if research_type:
            qs = qs.filter(research_type__iexact=research_type.strip())

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        if page is not None:
            serializer = ResearchActivitySerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = ResearchActivitySerializer(qs[:50], many=True)
        return Response(serializer.data)

    def post(self, request):
        """Allows explicitly logging an activity (e.g. from frontend RAG or custom search)."""
        ticker = request.data.get("ticker", "").strip().upper()
        if not ticker:
            return Response({"detail": "Ticker is required."}, status=status.HTTP_400_BAD_REQUEST)

        company_name = request.data.get("company_name", ticker)
        research_type = request.data.get("research_type", "quantitative")
        summary_data = request.data.get("summary_data", {})

        activity = ResearchActivity.objects.create(
            user=request.user,
            ticker=ticker,
            company_name=company_name,
            research_type=research_type,
            status="completed",
            summary_data=summary_data,
        )
        return Response(ResearchActivitySerializer(activity).data, status=status.HTTP_201_CREATED)


class ResearchHistoryDetailView(APIView):
    """
    Retrieves or deletes a single research history session owned by the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def _get_activity(self, activity_id, user):
        try:
            return ResearchActivity.objects.get(id=activity_id, user=user)
        except ResearchActivity.DoesNotExist:
            raise Http404("Research activity not found.")

    def get(self, request, activity_id):
        activity = self._get_activity(activity_id, request.user)
        return Response(ResearchActivitySerializer(activity).data)

    def delete(self, request, activity_id):
        activity = self._get_activity(activity_id, request.user)
        activity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# -------------------------------------------------------------
# User Personalized Dashboard Endpoint (Prompt 6)
# -------------------------------------------------------------

class UserDashboardView(APIView):
    """
    Aggregates personalized dashboard data for the authenticated user:
    - Welcome message & account metadata
    - Saved watchlist companies
    - Recent research history (quant and qual)
    - Recent generated 15-section reports with live statuses
    - Key account metrics & live subscription status
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        saved_companies = SavedCompany.objects.filter(user=user).order_by("-added_at")[:6]
        recent_activities = ResearchActivity.objects.filter(user=user).order_by("-created_at")[:6]
        recent_reports = ResearchReport.objects.filter(user=user).order_by("-generation_date")[:6]

        saved_count = SavedCompany.objects.filter(user=user).count()
        reports_count = ResearchReport.objects.filter(user=user).count()
        activities_count = ResearchActivity.objects.filter(user=user).count()

        subscription_data = UserSubscriptionStatusView.get_subscription_payload(user)

        user_name = user.first_name or user.username
        welcome_message = f"Welcome back, {user_name}! Here is your equity intelligence overview."

        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "date_joined": user.date_joined,
            },
            "welcome_message": welcome_message,
            "stats": {
                "saved_companies_count": saved_count,
                "reports_count": reports_count,
                "activities_count": activities_count,
            },
            "saved_companies": SavedCompanySerializer(saved_companies, many=True).data,
            "recent_activities": ResearchActivitySerializer(recent_activities, many=True).data,
            "recent_reports": ResearchReportListSerializer(recent_reports, many=True).data,
            "subscription": subscription_data,
        })


# -------------------------------------------------------------
# Authentication & Account Endpoints
# -------------------------------------------------------------

class AuthRegisterView(APIView):
    """
    Registers a new user with username and password, hashing the password securely via Django.
    Enforces username uniqueness and password confirmation.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "message": "User registered successfully. You can now sign in.",
            "token": token.key,
            "user": UserProfileSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class AuthLoginView(APIView):
    """
    Authenticates a user via username/password, logs in session, and returns an auth token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response(
                {"detail": "Invalid username or password credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "message": "Login successful.",
            "token": token.key,
            "user": UserProfileSerializer(user).data,
        })


class AuthLogoutView(APIView):
    """
    Logs out the current session and invalidates the authentication token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user.is_authenticated:
            try:
                Token.objects.filter(user=request.user).delete()
            except Exception:
                pass
            logout(request)

        return Response({"message": "Successfully logged out."})


class AuthUserView(APIView):
    """
    Returns current authenticated user details or guest state.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"is_authenticated": False, "user": None})

        return Response({
            "is_authenticated": True,
            "user": UserProfileSerializer(request.user).data,
            "subscription": UserSubscriptionStatusView.get_subscription_payload(request.user),
        })
