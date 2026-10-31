web: python manage.py migrate && python manage.py seed_principles && python manage.py init_admin && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --timeout 120
