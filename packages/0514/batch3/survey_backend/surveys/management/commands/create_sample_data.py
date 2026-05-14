from django.core.management.base import BaseCommand
from surveys.models import Survey, Question


class Command(BaseCommand):
    help = 'Create sample survey data with skip logic'

    def handle(self, *args, **options):
        survey, created = Survey.objects.get_or_create(
            title='用户健康调查',
            defaults={
                'description': '了解您的健康状况，提供更好的服务！'
            }
        )

        if created:
            q1 = Question.objects.create(
                survey=survey,
                text='您是否吸烟？',
                question_type='single',
                options=['是', '否'],
                order=1
            )

            q2 = Question.objects.create(
                survey=survey,
                text='您的吸烟频率是？',
                question_type='single',
                options=['每天', '每周几次', '偶尔', '已戒烟'],
                order=2,
                skip_logic={
                    'conditions': [
                        {
                            'question_id': None,
                            'answer': '否',
                            'action': 'skip',
                            'target_question_order': 3
                        }
                    ]
                }
            )

            q1.skip_logic = {
                'conditions': [
                    {
                        'answer': '是',
                        'action': 'next',
                        'target_question_order': 2
                    },
                    {
                        'answer': '否',
                        'action': 'jump',
                        'target_question_order': 3
                    }
                ]
            }
            q1.save()

            Question.objects.create(
                survey=survey,
                text='您每周运动多少次？',
                question_type='single',
                options=['0次', '1-2次', '3-5次', '5次以上'],
                order=3
            )

            Question.objects.create(
                survey=survey,
                text='您有什么健康建议？',
                question_type='text',
                order=4
            )

            self.stdout.write(self.style.SUCCESS('Sample survey with skip logic created successfully!'))
        else:
            self.stdout.write(self.style.WARNING('Sample survey already exists!'))
