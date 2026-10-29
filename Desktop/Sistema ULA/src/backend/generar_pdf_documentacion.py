# -*- coding: utf-8 -*-
"""
Script generador del documento oficial de documentación del sistema SIPREF en PDF.
Incluye el Diagrama Entidad-Relación (ER) oficial de alta resolución.
Universidad Latino.
"""

import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as PlatypusImage, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# Ensure ER diagram image exists
from generar_imagen_er import generar_diagrama_er

class NumberedCanvasDoc(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        # Do not draw headers/footers on cover page (page 1)
        if self._pageNumber == 1:
            return

        self.saveState()
        # Top Header
        self.setStrokeColor(colors.HexColor('#1c355e'))
        self.setLineWidth(1)
        self.line(40, 755, 612 - 40, 755)

        self.setFillColor(colors.HexColor('#1c355e'))
        self.setFont("Helvetica-Bold", 8.5)
        self.drawString(40, 760, "UNIVERSIDAD LATINO  |  SIPREF")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748b'))
        self.drawString(200, 760, "— Documentación Técnica, Funcional y Diagrama ER")

        # Small logo at top right
        logo_path = os.path.abspath("src/components/logo.png")
        if not os.path.exists(logo_path):
            logo_path = os.path.abspath("logo.png")
        if os.path.exists(logo_path):
            try:
                self.drawImage(logo_path, 612 - 40 - 22, 757, width=20, height=20, mask='auto', preserveAspectRatio=True)
            except Exception:
                pass

        # Bottom Footer
        self.setStrokeColor(colors.HexColor('#e2e8f0'))
        self.setLineWidth(0.5)
        self.line(40, 42, 612 - 40, 42)

        self.setFillColor(colors.HexColor('#64748b'))
        self.setFont("Helvetica", 8)
        self.drawString(40, 30, "SIPREF v1.0 — Dirección de Tecnologías e Información Académica")

        page_str = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(612 - 40, 30, page_str)

        self.restoreState()


def generar_documento_pdf(output_path: str):
    # Verify/generate ER diagram image first
    er_img_path = os.path.abspath("diagrama_er_sistema.png")
    if not os.path.exists(er_img_path):
        generar_diagrama_er(er_img_path)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=48,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    color_primary = colors.HexColor('#1c355e')
    color_secondary = colors.HexColor('#0284c7')
    color_dark = colors.HexColor('#0f172a')
    color_muted = colors.HexColor('#64748b')

    h1_style = ParagraphStyle(
        'DocH1', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=14, leading=18,
        textColor=color_primary, spaceBefore=12, spaceAfter=6, keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'DocH2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10.5, leading=14,
        textColor=color_secondary, spaceBefore=8, spaceAfter=4, keepWithNext=True
    )
    body_style = ParagraphStyle(
        'DocBody', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12.5,
        textColor=color_dark, spaceAfter=5
    )
    bullet_style = ParagraphStyle(
        'DocBullet', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12,
        textColor=color_dark, leftIndent=12, spaceAfter=4
    )
    th_style = ParagraphStyle(
        'DocTH', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8, leading=10,
        textColor=colors.white, alignment=1
    )
    td_style = ParagraphStyle(
        'DocTD', parent=styles['Normal'],
        fontName='Helvetica', fontSize=7.5, leading=9.5,
        textColor=color_dark
    )
    td_bold = ParagraphStyle(
        'DocTDBold', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
        textColor=color_primary
    )
    td_center = ParagraphStyle(
        'DocTDCenter', parent=styles['Normal'],
        fontName='Helvetica', fontSize=7.5, leading=9.5,
        textColor=color_dark, alignment=1
    )
    code_block = ParagraphStyle(
        'DocCode', parent=styles['Normal'],
        fontName='Courier', fontSize=7.5, leading=10,
        textColor=colors.HexColor('#094c72')
    )

    story = []

    # =========================================================================
    # PORTADA (COVER PAGE)
    # =========================================================================
    story.append(Spacer(1, 35))

    logo_path = os.path.abspath("src/components/logo.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.abspath("logo.png")

    if os.path.exists(logo_path):
        story.append(PlatypusImage(logo_path, width=105, height=98))
    
    story.append(Spacer(1, 20))

    p_inst = Paragraph("<b>UNIVERSIDAD LATINO</b>", ParagraphStyle('CoverInst', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=color_primary, alignment=1))
    story.append(p_inst)
    story.append(Spacer(1, 6))

    p_subinst = Paragraph("DIRECCIÓN DE TECNOLOGÍAS Y SISTEMAS ACADÉMICOS", ParagraphStyle('CoverSubInst', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=color_secondary, alignment=1))
    story.append(p_subinst)

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="60%", thickness=2, color=color_primary, spaceBefore=4, spaceAfter=18, hAlign='CENTER'))

    p_title = Paragraph("<b>S I P R E F</b>", ParagraphStyle('CoverMain', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=32, leading=38, textColor=color_primary, alignment=1))
    story.append(p_title)

    p_sysname = Paragraph("Sistema de Información, Programación y Registro de Espacios Físicos", ParagraphStyle('CoverSysName', parent=styles['Normal'], fontName='Helvetica', fontSize=11.5, leading=15, textColor=color_muted, alignment=1))
    story.append(p_sysname)

    story.append(Spacer(1, 25))

    p_docname = Paragraph("DOCUMENTO INTEGRAL DE ARQUITECTURA, ESPECIFICACIÓN TÉCNICA Y DIAGRAMA ENTIDAD-RELACIÓN", ParagraphStyle('CoverDocName', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=14, textColor=color_primary, alignment=1))
    story.append(p_docname)

    story.append(Spacer(1, 30))

    # Metadata card table on cover
    meta_data = [
        [Paragraph("<b>Versión del Software:</b>", td_style), Paragraph("1.0.0 (Producción Activa)", td_style)],
        [Paragraph("<b>Entorno:</b>", td_style), Paragraph("Cliente-Servidor (React SPA + FastAPI Backend)", td_style)],
        [Paragraph("<b>Base de Datos:</b>", td_style), Paragraph("TiDB Cloud Serverless (MySQL 8.0 Protocol)", td_style)],
        [Paragraph("<b>Diagrama ER:</b>", td_style), Paragraph("Incluido (19 tablas relacionales en 7 dominios)", td_style)],
        [Paragraph("<b>Fecha de Publicación:</b>", td_style), Paragraph(f"{datetime.now().strftime('%d de Octubre de %Y')}", td_style)],
        [Paragraph("<b>Clasificación:</b>", td_style), Paragraph("Documentación Oficial Institucional", td_style)],
    ]
    t_meta = Table(meta_data, colWidths=[150, 230])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(t_meta)

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 1: RESUMEN EJECUTIVO Y FICHA TÉCNICA
    # =========================================================================
    story.append(Paragraph("1. Resumen Ejecutivo y Ficha Técnica", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "El <b>Sistema de Información, Programación y Registro de Espacios Físicos (SIPREF)</b> es la plataforma tecnológica integral diseñada para la <b>Universidad Latino</b> "
        "con el propósito de administrar y supervisar en tiempo real la asignación de infraestructura física, horarios de clases, control de asistencias e incidencias docentes, "
        "calendarios escolares, exámenes y la reserva de aulas y auditorios para eventos institucionales.",
        body_style
    ))

    story.append(Paragraph(
        "El sistema resuelve de manera sistemática los conflictos de sobrecupo y colisión de horarios mediante un motor determinista de verificación de disponibilidad, "
        "además de ofrecer un entorno auditable que registra cada alteración en los registros institucionales con trazabilidad total.",
        body_style
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("Tabla 1.1 — Especificaciones del Stack Tecnológico", h2_style))

    tech_table_data = [
        [Paragraph("Capa / Componente", th_style), Paragraph("Tecnología", th_style), Paragraph("Versión / Motor", th_style), Paragraph("Función Principal", th_style)],
        [Paragraph("Frontend SPA", td_bold), Paragraph("React + Vite", td_style), Paragraph("React 18.2 / Vite 5.2", td_style), Paragraph("Interfaz de usuario interactiva y responsiva", td_style)],
        [Paragraph("Diseño Visual", td_bold), Paragraph("Tailwind CSS", td_style), Paragraph("Tailwind 3.4", td_style), Paragraph("Diseño corporativo y maquetación de componentes", td_style)],
        [Paragraph("Enrutamiento", td_bold), Paragraph("React Router DOM", td_style), Paragraph("v6.22 con Code Splitting", td_style), Paragraph("Navegación declarativa protegida por sesión", td_style)],
        [Paragraph("Backend API", td_bold), Paragraph("FastAPI (Python)", td_style), Paragraph("Python 3.11+ / Uvicorn", td_style), Paragraph("113 endpoints REST de alto rendimiento", td_style)],
        [Paragraph("Base de Datos", td_bold), Paragraph("TiDB Serverless", td_style), Paragraph("MySQL 8.0 / SSL Certifi", td_style), Paragraph("Motor relacional en la nube (19 tablas)", td_style)],
        [Paragraph("Motor de PDFs", td_bold), Paragraph("ReportLab Platypus", td_style), Paragraph("ReportLab 4.x", td_style), Paragraph("Generación vectorial de actas y calendarios con logo", td_style)],
        [Paragraph("Motor de Hojas", td_bold), Paragraph("OpenPyXL", td_style), Paragraph("OpenPyXL 3.1", td_style), Paragraph("Reportes en Excel con membrete, logo y estilos", td_style)],
        [Paragraph("Comunicaciones", td_bold), Paragraph("SMTP / email.mime", td_style), Paragraph("Protocolo TLS (587)", td_style), Paragraph("Notificaciones, envío de reportes y OTP de seguridad", td_style)],
    ]
    t_tech = Table(tech_table_data, colWidths=[90, 95, 110, 237])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color_primary),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_tech)

    # =========================================================================
    # SECCIÓN 2: ARQUITECTURA Y FLUJO DE DATOS
    # =========================================================================
    story.append(Spacer(1, 10))
    story.append(Paragraph("2. Arquitectura del Sistema y Flujo Operativo", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "SIPREF está estructurado bajo un patrón de <b>arquitectura desacoplada en tres niveles</b>: Presentación (Frontend SPA), Lógica de Aplicación (API REST FastAPI) y Persistencia (TiDB Cloud):",
        body_style
    ))

    arch_items = [
        "<b>Nivel de Presentación (Frontend):</b> Aplicación de una sola página (SPA) empaquetada con Vite. Utiliza carga diferida (<i>lazy loading</i>) en todas las rutas para optimizar los tiempos de carga inicial. Integra <code>UserContext</code> para validar la persistencia de sesión por día calendario y <code>TimeContext</code> con un simulador de tiempo que permite recrear eventos académicos en cualquier fecha u hora deseada para auditoría.",
        "<b>Nivel de Lógica y Negocio (Backend):</b> Servidor ASGI FastAPI que implementa esquemas Pydantic v2 para validación estricta de entradas. Incluye un ciclo de vida (<i>lifespan</i>) que inicializa un trabajador en segundo plano (<code>worker_procesar_recordatorios</code>) que corre concurrentemente con el event-loop de <code>asyncio</code>.",
        "<b>Nivel de Persistencia y Conectividad:</b> Conexión segura a TiDB mediante certificados SSL validados por <code>certifi.where()</code>, soportando transacciones seguras (ACID) y pool de conexiones.",
        "<b>Servicios de Exportación y Notificación:</b> Módulos especializados que ensamblan reportes institucionales integrando el escudo oficial <code>logo.png</code> tanto en PDF como en hojas de cálculo Excel, además de un cliente SMTP con soporte para correo HTML y archivos adjuntos."
    ]
    for it in arch_items:
        story.append(Paragraph(f"• {it}", bullet_style))

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 3: DIAGRAMA ENTIDAD-RELACIÓN (ER) VISUAL
    # =========================================================================
    story.append(Paragraph("3. Diagrama de Entidad-Relación (ER) del Sistema", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=6))

    story.append(Paragraph(
        "A continuación se presenta el <b>Diagrama Entidad-Relación oficial</b> del Sistema SIPREF. "
        "El modelo contiene <b>19 tablas relacionales</b> distribuidas en 7 dominios: <i>1. Usuarios y Seguridad</i>, <i>2. Docentes y Suplencias</i>, "
        "<i>3. Aulas e Infraestructura</i>, <i>4. Horarios y Registro de Clases</i>, <i>5. Agenda y Reservas</i>, <i>6. Calendarios y Exámenes</i> y <i>7. Auditoría y Trazabilidad</i>:",
        body_style
    ))

    # Embed High-Resolution ER Diagram Image
    if os.path.exists(er_img_path):
        # 532 pt width available, aspect ratio 1.458 -> height = 365 pt
        story.append(PlatypusImage(er_img_path, width=532, height=365))
        story.append(Spacer(1, 4))
        story.append(Paragraph("<b>Figura 3.1:</b> Diagrama Entidad-Relación integral con llaves primarias [PK], llaves foráneas [FK] y conectores de cardinalidad.", ParagraphStyle('FigCaption', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=7.5, leading=10, textColor=color_muted, alignment=1)))
    
    story.append(Spacer(1, 6))
    story.append(Paragraph("Matriz de Relaciones y Cardinalidad Principal", h2_style))

    rel_matrix_data = [
        [Paragraph("Entidad Origen", th_style), Paragraph("Cardinalidad", th_style), Paragraph("Entidad Destino", th_style), Paragraph("Clave Foránea / Vínculo", th_style), Paragraph("Propósito Operativo", th_style)],
        [Paragraph("usuarios_pendientes", td_bold), Paragraph("1 : 1", td_center), Paragraph("usuarios", td_style), Paragraph("correo / verification_code", code_block), Paragraph("Activación de cuenta tras verificar OTP.", td_style)],
        [Paragraph("docentes", td_bold), Paragraph("1 : N", td_center), Paragraph("suplencias", td_style), Paragraph("docente_id, suplente_id", code_block), Paragraph("Reemplazo temporal ante ausencias del titular.", td_style)],
        [Paragraph("docentes", td_bold), Paragraph("1 : N", td_center), Paragraph("horarios", td_style), Paragraph("docente (nombre)", code_block), Paragraph("Asignación de carga docente a materias.", td_style)],
        [Paragraph("aulas", td_bold), Paragraph("1 : N", td_center), Paragraph("horarios", td_style), Paragraph("aula_asignada (nombre)", code_block), Paragraph("Espacio físico donde se imparte cada clase regular.", td_style)],
        [Paragraph("aulas", td_bold), Paragraph("1 : N", td_center), Paragraph("aulas_liberadas", td_style), Paragraph("aula_nombre", code_block), Paragraph("Registro de aulas vacías antes del fin de hora.", td_style)],
        [Paragraph("aulas", td_bold), Paragraph("1 : N", td_center), Paragraph("eventos_aulas", td_style), Paragraph("aula_nombre", code_block), Paragraph("Reserva de aula o auditorio para evento especial.", td_style)],
        [Paragraph("eventos_aulas", td_bold), Paragraph("1 : N", td_center), Paragraph("eventos_recordatorios", td_style), Paragraph("evento_id", code_block), Paragraph("Alertas automáticas por correo electrónico.", td_style)],
        [Paragraph("eventos_aulas", td_bold), Paragraph("1 : N", td_center), Paragraph("eventos_historial", td_style), Paragraph("evento_id", code_block), Paragraph("Pista de auditoría de creaciones y cancelaciones.", td_style)],
        [Paragraph("horarios", td_bold), Paragraph("1 : N", td_center), Paragraph("clases_historico", td_style), Paragraph("clase_id", code_block), Paragraph("Generación de asistencia y estado diario de clase.", td_style)],
        [Paragraph("horarios", td_bold), Paragraph("1 : N", td_center), Paragraph("historial_periodos", td_style), Paragraph("cierre de ciclo", code_block), Paragraph("Archivo de horarios al término del semestre.", td_style)],
    ]
    t_rel = Table(rel_matrix_data, colWidths=[100, 45, 100, 115, 172])
    t_rel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color_primary),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_rel)

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 4: MODELO DE BASE DE DATOS (19 TABLAS)
    # =========================================================================
    story.append(Paragraph("4. Diccionario de Tablas y Atributos", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "A continuación se desglosan las especificaciones de almacenamiento de las <b>19 tablas relacionales</b> del sistema:",
        body_style
    ))

    tables_catalog = [
        [Paragraph("Nombre de Tabla", th_style), Paragraph("Llave Primaria / Claves", th_style), Paragraph("Campos Relevantes", th_style), Paragraph("Descripción del Módulo", th_style)],
        
        # Usuarios
        [Paragraph("usuarios", td_bold), Paragraph("id (PK)<br/>correo (UK)", td_style), Paragraph("nombre, correo, turno, password, is_verified, ultima_conexion", td_style), Paragraph("Cuentas de administradores y coordinadores activos.", td_style)],
        [Paragraph("usuarios_pendientes", td_bold), Paragraph("id (PK)<br/>correo (UK)", td_style), Paragraph("nombre, correo, turno, verification_code, expira", td_style), Paragraph("Registros en espera de validación mediante código OTP de 6 dígitos.", td_style)],
        
        # Docentes y Suplencias
        [Paragraph("docentes", td_bold), Paragraph("id (PK)", td_style), Paragraph("nombre, especialidad, materias (JSON), correo", td_style), Paragraph("Catálogo de profesores y materias que imparten.", td_style)],
        [Paragraph("suplencias", td_bold), Paragraph("id (PK)<br/>docente_id (FK)<br/>suplente_id (FK)", td_style), Paragraph("materia, dia, fecha, hora_inicio, hora_fin, activa", td_style), Paragraph("Suplencias registradas mediante identificadores numéricos.", td_style)],
        [Paragraph("suplencias_horarios", td_bold), Paragraph("id (PK)", td_style), Paragraph("docente_nombre, suplente_nombre, materia, fecha, horario", td_style), Paragraph("Reemplazos de docentes mapeados por nombre directo en horarios.", td_style)],
        
        # Horarios y Clases
        [Paragraph("horarios", td_bold), Paragraph("id (PK)", td_style), Paragraph("docente, asignatura, horario, aula_asignada, semestre, grupo, archivo", td_style), Paragraph("Horarios vigentes cargados desde archivos oficiales.", td_style)],
        [Paragraph("clases_historico", td_bold), Paragraph("id (PK)<br/>clase_id (FK)", td_style), Paragraph("fecha, dia_semana, docente, aula_actual, estado_slug, incidencia_detalle", td_style), Paragraph("Registro histórico diario de asistencias, aulas e incidencias.", td_style)],
        [Paragraph("historial_periodos_cerrados", td_bold), Paragraph("id (PK)", td_style), Paragraph("nombre_ciclo, tipo_periodo, horario, materia, docente, aula, carrera", td_style), Paragraph("Resguardo inmutable de ciclos académicos concluidos.", td_style)],
        [Paragraph("historial_reprogramaciones_semanal", td_bold), Paragraph("id (PK)", td_style), Paragraph("docente, materia, horario_reposicion, fecha_reposicion, aula", td_style), Paragraph("Bitácora de clases reprogramadas y recuperadas.", td_style)],
        
        # Aulas y Espacios
        [Paragraph("aulas", td_bold), Paragraph("id (PK)<br/>nombre (UK)", td_style), Paragraph("nombre, edificio, capacidad, equipos (JSON), en_mantenimiento, temporal", td_style), Paragraph("Inventario de espacios físicos y estado de conservación.", td_style)],
        [Paragraph("aulas_liberadas", td_bold), Paragraph("id (PK)", td_style), Paragraph("aula_nombre, fecha, docente, asignatura, horario, motivo, activa", td_style), Paragraph("Aulas desocupadas antes de tiempo disponibles hoy.", td_style)],
        
        # Eventos y Reservas
        [Paragraph("eventos_aulas", td_bold), Paragraph("id (PK)", td_style), Paragraph("tipo_evento, nombre_evento, aula_nombre, fecha, horas, responsable, estado", td_style), Paragraph("Reservaciones extraordinarias de aulas y auditorios.", td_style)],
        [Paragraph("eventos_recordatorios", td_bold), Paragraph("id (PK)<br/>evento_id (FK)", td_style), Paragraph("tipo, fecha_programada, estado, fecha_envio, error_log", td_style), Paragraph("Alertas automáticas por correo previo a los eventos.", td_style)],
        [Paragraph("eventos_historial", td_bold), Paragraph("id (PK)<br/>evento_id (FK)", td_style), Paragraph("usuario, accion, detalles, fecha", td_style), Paragraph("Trazabilidad completa de modificaciones en eventos.", td_style)],
        
        # Calendarios
        [Paragraph("calendarios", td_bold), Paragraph("id (PK)", td_style), Paragraph("tipo, carrera, archivo_nombre, archivo_url, created_at", td_style), Paragraph("Archivos de calendarios subidos a la plataforma.", td_style)],
        [Paragraph("examenes_calendario", td_bold), Paragraph("id (PK)", td_style), Paragraph("carrera, periodo, semestre, dia, fecha, materia, ciclo_escolar", td_style), Paragraph("Programación de exámenes parciales y ordinarios.", td_style)],
        [Paragraph("calendario_institucional", td_bold), Paragraph("id (PK)", td_style), Paragraph("plan, ciclo, periodo, tipo_evento, fecha_inicio, fecha_fin, suspende_clases", td_style), Paragraph("Fechas oficiales institucionales y suspensiones de labores.", td_style)],
        
        # Auditoría
        [Paragraph("bitacora_cambios", td_bold), Paragraph("id (PK)", td_style), Paragraph("usuario, operacion, modulo, aula_anterior, aula_nueva, motivo, diff_json", td_style), Paragraph("Pista de auditoría inmutable de todas las acciones CRUD.", td_style)],
        [Paragraph("auditoria_exportaciones", td_bold), Paragraph("id (PK)", td_style), Paragraph("usuario_nombre, tipo_exportacion, filtros, cantidad, fecha_hora", td_style), Paragraph("Registro legal de reportes y archivos exportados.", td_style)],
        [Paragraph("reportes_compartidos", td_bold), Paragraph("id (PK UUID)", td_style), Paragraph("nombre_archivo, tipo, contenido (BLOB), fecha_hora", td_style), Paragraph("Almacenamiento de reportes accesibles mediante enlaces.", td_style)],
    ]

    t_cat = Table(tables_catalog, colWidths=[105, 95, 172, 160])
    t_cat.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color_primary),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_cat)

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 5: MÓDULOS FUNCIONALES
    # =========================================================================
    story.append(Paragraph("5. Descripción Detallada de Módulos Funcionales", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("5.1. Dashboard y Monitor de Aulas en Tiempo Real (VisualBd)", h2_style))
    story.append(Paragraph(
        "Es el centro neurálgico del sistema. Compara la hora del reloj en curso contra todas las clases programadas en la base de datos para clasificar cada aula en 5 estados visuales:",
        body_style
    ))
    story.append(Paragraph("• <b>Disponible (Verde):</b> El aula no tiene clase regular ni evento agendado en el intervalo actual.", bullet_style))
    story.append(Paragraph("• <b>Ocupada en Clase (Azul):</b> Se está impartiendo una materia con su docente titular o suplente asignado.", bullet_style))
    story.append(Paragraph("• <b>Evento en Curso (Púrpura):</b> El aula se encuentra reservada para una actividad especial confirmada.", bullet_style))
    story.append(Paragraph("• <b>Liberada Anticipadamente (Ámbar):</b> El docente notificó término previo de su clase, habilitando el espacio.", bullet_style))
    story.append(Paragraph("• <b>En Mantenimiento (Gris/Rojo):</b> El aula está bloqueada por obras o reparaciones, redirigiendo alumnos a un aula temporal.", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("5.2. Gestión de Horarios y Espacios", h2_style))
    story.append(Paragraph(
        "Permite cargar documentos en PDF y Excel emitidos por las coordinaciones. El parser extrae automáticamente: carrera, materia, docente, grupo, días y horas. "
        "El módulo cuenta con detección instantánea de colisiones de salón y permite reasignar aulas con un solo clic. "
        "Asimismo, ofrece la funcionalidad de <b>Cierre de Periodo</b>, que transfiere en bulto los horarios a tablas históricas al término de cada ciclo.",
        body_style
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("5.3. Directorio Docente y Suplencias", h2_style))
    story.append(Paragraph(
        "Mantiene el padrón de académicos de la universidad. Cuando un docente presenta incapacidad o permiso, se activa el sub-módulo de suplencias. "
        "El sistema valida la compatibilidad horaria del suplente y actualiza el monitor de aulas para reflejar quién está cubriendo la materia en dicha fecha.",
        body_style
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("5.4. Agenda y Reservación de Eventos Especiales", h2_style))
    story.append(Paragraph(
        "Permite solicitar salones y auditorios para defensas de tesis, conferencias, exámenes extraordinarios y cursos extracurriculares. "
        "Antes de confirmar una reserva, ejecuta un algoritmo de disponibilidad que valida que el aula no tenga clases regulares ni otro evento previo. "
        "El ciclo de vida del evento es gestionado automáticamente por el worker de fondo en tres etapas: <b>Programado ➔ En curso ➔ Finalizado</b>.",
        body_style
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("5.5. Auditoría, Pistas de Cambio y Reportes", h2_style))
    story.append(Paragraph(
        "Cada acción que altera datos sensibles (cambio de aula, edición de horario, sustitución docente) genera una entrada inmutable en la tabla <code>bitacora_cambios</code> "
        "guardando el valor anterior, el valor nuevo, el usuario autor y la dirección IP. El módulo permite descargar reportes oficiales en PDF y Excel con membrete del escudo universitario.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 6: CATÁLOGO DE API REST (ENDPOINTS CLAVE)
    # =========================================================================
    story.append(Paragraph("6. Catálogo de la API REST (Principales Endpoints)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "El backend expone <b>113 endpoints</b>. A continuación se documentan los 25 servicios más representativos divididos por dominio operativo:",
        body_style
    ))

    endpoints_data = [
        [Paragraph("Método", th_style), Paragraph("Ruta del Endpoint", th_style), Paragraph("Descripción Operativa", th_style), Paragraph("Respuestas HTTP", th_style)],
        
        # Auth
        [Paragraph("POST", td_bold), Paragraph("/api/login", code_block), Paragraph("Autenticación con usuario y contraseña hasheada.", td_style), Paragraph("200 OK, 401 Unauthorized", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/registro", code_block), Paragraph("Registro inicial y despacho de código numérico OTP.", td_style), Paragraph("200 OK, 400 Bad Request", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/verificar-correo", code_block), Paragraph("Valida OTP de 6 dígitos y confirma la cuenta de usuario.", td_style), Paragraph("200 OK, 400 Expired/Invalid", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/recuperar-contrasena", code_block), Paragraph("Genera token temporal para recuperación de acceso.", td_style), Paragraph("200 OK, 404 Not Found", td_center)],
        [Paragraph("GET", td_bold), Paragraph("/api/usuarios", code_block), Paragraph("Lista usuarios registrados y presencia en línea.", td_style), Paragraph("200 OK", td_center)],
        
        # Horarios
        [Paragraph("GET", td_bold), Paragraph("/api/horarios", code_block), Paragraph("Consulta horarios activos con filtros por carrera/semestre.", td_style), Paragraph("200 OK", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/horarios", code_block), Paragraph("Registra una asignación de clase con validación de aula.", td_style), Paragraph("200 OK, 409 Conflict", td_center)],
        [Paragraph("PUT", td_bold), Paragraph("/api/horarios/{id}", code_block), Paragraph("Modifica horario o aula y asienta registro en bitácora.", td_style), Paragraph("200 OK, 404 Not Found", td_center)],
        [Paragraph("DELETE", td_bold), Paragraph("/api/horarios/{id}", code_block), Paragraph("Elimina un horario del semestre activo.", td_style), Paragraph("200 OK", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/horarios/cierre-periodo", code_block), Paragraph("Cierra ciclo y archiva horarios en historial.", td_style), Paragraph("200 OK", td_center)],
        
        # Aulas
        [Paragraph("GET", td_bold), Paragraph("/api/aulas", code_block), Paragraph("Lista de salones, capacidades y equipamiento.", td_style), Paragraph("200 OK", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/aulas/{id}/mantenimiento", code_block), Paragraph("Bloquea aula por mantenimiento y asigna temporal.", td_style), Paragraph("200 OK", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/aulas/liberar", code_block), Paragraph("Registra salida anticipada liberando el aula hoy.", td_style), Paragraph("200 OK", td_center)],
        
        # Docentes
        [Paragraph("GET", td_bold), Paragraph("/api/docentes", code_block), Paragraph("Directorio maestro de docentes y asignaturas.", td_style), Paragraph("200 OK", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/suplencias", code_block), Paragraph("Asigna docente suplente en un rango de fechas.", td_style), Paragraph("200 OK, 400 Error", td_center)],
        [Paragraph("GET", td_bold), Paragraph("/api/suplencias-activas", code_block), Paragraph("Consulta suplencias vigentes para la fecha actual.", td_style), Paragraph("200 OK", td_center)],
        
        # Eventos
        [Paragraph("POST", td_bold), Paragraph("/api/eventos/verificar-disponibilidad", code_block), Paragraph("Comprueba colisiones de horario en un salón.", td_style), Paragraph("200 OK (disponible/conflicto)", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/eventos", code_block), Paragraph("Crea reserva de aula y programa recordatorios por email.", td_style), Paragraph("201 Created, 409 Conflict", td_center)],
        [Paragraph("GET", td_bold), Paragraph("/api/eventos", code_block), Paragraph("Lista eventos con filtros de estado y fechas.", td_style), Paragraph("200 OK", td_center)],
        [Paragraph("GET", td_bold), Paragraph("/api/eventos/exportar/pdf", code_block), Paragraph("Genera reporte PDF oficial con logo de reservas.", td_style), Paragraph("200 OK (application/pdf)", td_center)],
        [Paragraph("GET", td_bold), Paragraph("/api/eventos/exportar/excel", code_block), Paragraph("Exporta libro de eventos a formato Excel.", td_style), Paragraph("200 OK (application/xlsx)", td_center)],
        
        # Exámenes y Reportes
        [Paragraph("GET", td_bold), Paragraph("/api/examenes-calendario/exportar/pdf", code_block), Paragraph("Genera PDF del calendario de exámenes sin solapamiento.", td_style), Paragraph("200 OK (application/pdf)", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/examenes-calendario/enviar-correo", code_block), Paragraph("Despacha por SMTP el calendario en PDF/Excel.", td_style), Paragraph("200 OK, 500 Error", td_center)],
        [Paragraph("POST", td_bold), Paragraph("/api/exportar/pdf", code_block), Paragraph("Genera reporte de horarios del dashboard en PDF.", td_style), Paragraph("200 OK (application/pdf)", td_center)],
        [Paragraph("GET", td_bold), Paragraph("/api/bitacora", code_block), Paragraph("Consulta el registro de auditoría de cambios del sistema.", td_style), Paragraph("200 OK", td_center)],
    ]

    t_eps = Table(endpoints_data, colWidths=[55, 175, 212, 90])
    t_eps.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color_primary),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_eps)

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 7: REGLAS DE NEGOCIO, ALGORITMOS Y SEGUNDO PLANO
    # =========================================================================
    story.append(Paragraph("7. Reglas de Negocio, Algoritmos y Tareas en Segundo Plano", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("7.1. Algoritmo de Detección de Conflictos de Horario", h2_style))
    story.append(Paragraph(
        "Toda asignación de clase y toda reserva de aula es evaluada mediante la intersección de conjuntos temporales. "
        "Dos asignaciones <i>A</i> y <i>B</i> para un mismo espacio físico en la misma fecha entran en conflicto si y solo si:",
        body_style
    ))
    
    # Formula box
    formula_data = [[Paragraph("<b>Condición de Conflicto:</b> &nbsp; (HoraInicio<sub>A</sub> &lt; HoraFin<sub>B</sub>) &nbsp; <b>AND</b> &nbsp; (HoraFin<sub>A</sub> &gt; HoraInicio<sub>B</sub>)", ParagraphStyle('Formula', parent=body_style, fontName='Helvetica-Bold', fontSize=9, textColor=color_primary, alignment=1))]]
    t_formula = Table(formula_data, colWidths=[532])
    t_formula.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#93C5FD')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(t_formula)
    story.append(Spacer(1, 6))

    story.append(Paragraph("7.2. Motor Asíncrono de Sincronización y Recordatorios (Worker)", h2_style))
    story.append(Paragraph(
        "Al arrancar FastAPI mediante el gestor <code>lifespan</code>, se lanza la corrutina <code>worker_procesar_recordatorios()</code> "
        "que opera en bucle no bloqueante con las siguientes responsabilidades periódicas:",
        body_style
    ))
    story.append(Paragraph("• <b>Transición Automática de Estados:</b> Consulta las reservas del día de hoy y actualiza el campo <code>estado</code>: si la hora actual se encuentra dentro del rango de inicio y fin, transita a <b>'En curso'</b>; si la hora actual supera la hora fin, transita a <b>'Finalizado'</b>.", bullet_style))
    story.append(Paragraph("• <b>Despacho de Recordatorios SMTP:</b> Lee la tabla <code>eventos_recordatorios</code> buscando avisos con <code>fecha_programada &lt;= NOW()</code> y estado <code>'pendiente'</code>. Ensambla correos electrónicos en formato HTML responsivo y los envía a los organizadores, marcando el registro como <code>'enviado'</code> con marca de tiempo.", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("7.3. Membretado Institucional y Estándar Anti-Solapamiento", h2_style))
    story.append(Paragraph(
        "Para cumplir con los estándares de identidad gráfica de la Universidad Latino, los generadores de archivos implementan:",
        body_style
    ))
    story.append(Paragraph("• <b>Inclusión Dinámica del Logo:</b> La función <code>_obtener_ruta_logo()</code> localiza <code>logo.png</code> en rutas absolutas y relativas tanto en entornos de desarrollo como de despliegue en servidor.", bullet_style))
    story.append(Paragraph("• <b>Renderizado por Párrafos Auto-Envolventes:</b> En ReportLab se reemplazaron los textos simples por componentes <code>Paragraph</code> con estilos de interlineado (<i>leading</i>) y cálculo estricto de anchos de columna (<code>colWidths</code>). Esto garantiza que textos extensos como <i>'Exámenes Parciales y Ordinarios'</i> o nombres largos de asignaturas se distribuyan en múltiples líneas sin invadir celdas contiguas.", bullet_style))

    story.append(Spacer(1, 10))
    story.append(Paragraph("8. Guía de Instalación y Despliegue", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=color_primary, spaceBefore=2, spaceAfter=8))

    deploy_data = [
        [Paragraph("Paso", th_style), Paragraph("Instrucción / Comando", th_style), Paragraph("Propósito", th_style)],
        [Paragraph("1", td_bold), Paragraph("<code>git clone &lt;repo&gt; &amp;&amp; cd &quot;Sistema ULA&quot;</code>", code_block), Paragraph("Descarga del código fuente del proyecto.", td_style)],
        [Paragraph("2", td_bold), Paragraph("<code>python -m venv .venv &amp;&amp; .\\.venv\\Scripts\\activate</code>", code_block), Paragraph("Creación y activación de entorno virtual Python.", td_style)],
        [Paragraph("3", td_bold), Paragraph("<code>pip install -r requirements.txt</code>", code_block), Paragraph("Instalación de FastAPI, Uvicorn, PyMySQL, ReportLab, etc.", td_style)],
        [Paragraph("4", td_bold), Paragraph("<code>npm install</code>", code_block), Paragraph("Instalación de paquetes de dependencias de React y Tailwind.", td_style)],
        [Paragraph("5", td_bold), Paragraph("<code>configurar archivo .env con credenciales de BD y SMTP</code>", code_block), Paragraph("Configuración de TiDB Cloud y servidor de correos.", td_style)],
        [Paragraph("6", td_bold), Paragraph("<code>python src/backend/main.py</code>", code_block), Paragraph("Arranque del servidor backend en puerto 8000.", td_style)],
        [Paragraph("7", td_bold), Paragraph("<code>npm run dev</code>", code_block), Paragraph("Lanzamiento del servidor de desarrollo Vite en puerto 5173.", td_style)],
    ]
    t_dep = Table(deploy_data, colWidths=[35, 270, 227])
    t_dep.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), color_primary),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_dep)

    # Build document
    doc.build(story, canvasmaker=NumberedCanvasDoc)
    print(f"PDF generado exitosamente en: {output_path}")

if __name__ == "__main__":
    out_file = os.path.abspath("Documentacion_Sistema_SIPREF_ULA.pdf")
    generar_documento_pdf(out_file)
