from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    dependencies=[('opportunities','0004_clientshortlist_clientinvite'),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[
        migrations.AlterField(model_name='job',name='status',field=models.CharField(max_length=20,default='pending_review',choices=[('pending_review','Pending review'),('published','Published'),('rejected','Rejected'),('closed','Closed'),('suspended','Suspended')])),
        migrations.AddField(model_name='job',name='moderation_source',field=models.CharField(max_length=15,default='pending',choices=[('pending','Pending'),('automated','Automated'),('staff','Staff'),('practice','Practice')])),
        migrations.AddField(model_name='job',name='moderation_score',field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name='job',name='moderation_reasons',field=models.JSONField(default=list,blank=True)),
        migrations.AddField(model_name='job',name='moderated_at',field=models.DateTimeField(null=True,blank=True)),
        migrations.CreateModel(name='JobModerationEvent',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('source',models.CharField(max_length=15)),
            ('old_status',models.CharField(max_length=20,blank=True)),
            ('new_status',models.CharField(max_length=20)),
            ('reason',models.TextField()),
            ('score',models.PositiveSmallIntegerField(default=0)),
            ('created_at',models.DateTimeField(auto_now_add=True)),
            ('job',models.ForeignKey(to='opportunities.job',on_delete=django.db.models.deletion.CASCADE,related_name='moderation_events')),
            ('actor',models.ForeignKey(to=settings.AUTH_USER_MODEL,null=True,blank=True,on_delete=django.db.models.deletion.SET_NULL)),
        ],options={'ordering':['-created_at']})
    ]
