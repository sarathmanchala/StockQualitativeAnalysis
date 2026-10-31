import os
import logging
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Ensures the default user exists in the database for instant authentication."

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.getenv("DEFAULT_USER", "Sarath").strip()
        password = os.getenv("DEFAULT_PASSWORD", "Teja@2003").strip()
        email = os.getenv("DEFAULT_EMAIL", "tejamanchala200e@gmail.com").strip()

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        # Always ensure password matches
        user.set_password(password)
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Successfully created initial user: '{username}'"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Initial user '{username}' already exists; password synchronized."))
