import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler providing consistent error responses across all APIs:
    {
        "success": false,
        "error": {
            "code": "<error_code>",
            "message": "<message>",
            "details": <details_dict_or_list_if_any>
        }
    }
    """
    # Call REST framework's default exception handler first to get the standard error response.
    response = exception_handler(exc, context)

    view_name = context.get("view").__class__.__name__ if context.get("view") else "UnknownView"

    if response is not None:
        error_code = "client_error"
        if response.status_code == 400:
            error_code = "validation_error"
        elif response.status_code == 401:
            error_code = "unauthenticated"
        elif response.status_code == 403:
            error_code = "permission_denied"
        elif response.status_code == 404:
            error_code = "not_found"
        elif response.status_code == 405:
            error_code = "method_not_allowed"

        message = "An error occurred while processing your request."
        details = response.data

        # If details is a dict with 'detail', extract message
        if isinstance(response.data, dict) and "detail" in response.data:
            message = str(response.data["detail"])

        response.data = {
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "details": details,
            },
            "detail": message,
        }
        return response

    # Unhandled server exception (500)
    logger.exception(
        "Unhandled server error occurred in view %s: %s",
        view_name,
        exc,
        exc_info=exc,
    )
    return Response(
        {
            "success": False,
            "error": {
                "code": "internal_server_error",
                "message": "An unexpected internal server error occurred.",
            },
            "detail": "An unexpected internal server error occurred.",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
