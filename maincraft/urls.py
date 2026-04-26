"""
URL configuration for maincraft project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from game import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('tools/', views.tools_portal, name='tools_portal'),
    path('monitor/', views.server_monitor, name='server_monitor'),
    path('live-map/', views.live_map, name='live_map'),
    path('schem-editor/', views.schematic_editor, name='schematic_editor'),
    path('panel/', views.admin_panel, name='admin_panel'),
    path('tutorial/', views.tutorial, name='tutorial'),
    path('wiki/', views.wiki, name='wiki'),
    path('clone/', views.clone_game, name='clone_game'),
    path('api/status/', views.api_status, name='api_status'),
    path('api/chat/', views.api_chat, name='api_chat'),
    path('api/panel/broadcast/', views.api_panel_broadcast, name='api_panel_broadcast'),
    path('api/panel/give/', views.api_panel_give, name='api_panel_give'),
    path('api/panel/time/', views.api_panel_time, name='api_panel_time'),
    path('api/schematic/export/', views.api_schematic_export, name='api_schematic_export'),
]
