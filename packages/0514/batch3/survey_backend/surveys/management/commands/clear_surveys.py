from django.core.management.base import BaseCommand
from surveys.models import Survey


class Command(BaseCommand):
    help = 'Clear all survey data'

    def handle(self, *args, **options):
        Survey.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('All survey data cleared!'))
