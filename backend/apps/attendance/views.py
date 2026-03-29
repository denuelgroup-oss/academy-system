from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ClientAttendance
from .serializers import ClientAttendanceSerializer, BulkAttendanceSerializer
from apps.clients.models import Client
from apps.classes.models import AcademyClass, ClassSchedule


class ClientAttendanceViewSet(viewsets.ModelViewSet):
    queryset = ClientAttendance.objects.select_related(
        'client', 'academy_class', 'class_schedule'
    ).all()
    serializer_class = ClientAttendanceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['date', 'status', 'academy_class', 'client', 'class_schedule']
    search_fields = ['client__first_name', 'client__last_name']
    ordering_fields = ['date', 'status']

    @action(detail=False, methods=['post'], url_path='bulk-mark')
    def bulk_mark(self, request):
        """
        Mark attendance for all students in a class on a given date.
        Payload: { date, academy_class, class_schedule (optional), records: [{client_id, status, notes}] }
        """
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        academy_class_id = data.get('academy_class')
        date = data['date']
        schedule_id = data.get('class_schedule')
        records = data['records']

        created, updated = 0, 0
        errors = []
        academy_class = None
        if academy_class_id:
            try:
                academy_class = AcademyClass.objects.get(pk=academy_class_id)
            except AcademyClass.DoesNotExist:
                return Response({'detail': 'Class not found.'}, status=400)

        for record in records:
            client_id = record.get('client_id')
            att_status = record.get('status', 'present')
            notes = record.get('notes', '')
            try:
                client = Client.objects.get(pk=client_id)
                obj, is_created = ClientAttendance.objects.update_or_create(
                    client=client,
                    date=date,
                    defaults={
                        'academy_class': academy_class,
                        'status': att_status,
                        'notes': notes,
                        'class_schedule_id': schedule_id,
                        'marked_by': request.user.get_full_name() or request.user.username,
                    }
                )
                if is_created:
                    created += 1
                else:
                    updated += 1
            except Client.DoesNotExist as e:
                errors.append({'client_id': client_id, 'error': str(e)})

        return Response({
            'created': created,
            'updated': updated,
            'errors': errors,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='by-date')
    def by_date(self, request):
        """Get attendance for a specific date, optionally filtered by class."""
        date = request.query_params.get('date')
        academy_class_id = request.query_params.get('academy_class')
        if not date:
            return Response({'detail': 'date is required.'}, status=400)

        # Get active students — filtered by class if provided, otherwise all active clients
        if academy_class_id:
            students = Client.objects.filter(
                academy_class_id=academy_class_id, status='active'
            )
            attendance_qs = ClientAttendance.objects.filter(
                date=date, academy_class_id=academy_class_id
            )
        else:
            students = Client.objects.filter(status='active')
            attendance_qs = ClientAttendance.objects.filter(date=date)

        attendance_map = {a.client_id: a for a in attendance_qs}
        result = []
        for student in students:
            att = attendance_map.get(student.id)
            result.append({
                'client_id': student.id,
                'client_name': str(student),
                'status': att.status if att else None,
                'notes': att.notes if att else '',
                'attendance_id': att.id if att else None,
            })
        return Response(result)
