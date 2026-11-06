# ============================================================================
# MODULO DE INCIDENCIAS DOCENTES (PREFECTURA ULA)
# ============================================================================

class IncidenciaDocente(BaseModel):
    fecha: str
    docente_nombre: str
    docente_id: Optional[int] = None
    tipo_incidencia: str = 'falta'  # 'falta', 'retardo', 'salida_anticipada', 'otro'
    falta_horas: Optional[str] = ''
    retardo: Optional[str] = ''
    salida_anticipada: Optional[str] = ''
    licenciatura: Optional[str] = ''
    grado_grupo: Optional[str] = ''
    asignatura: Optional[str] = ''
    aula: Optional[str] = ''
    observaciones: Optional[str] = ''
    registrado_por: Optional[str] = 'Prefectura'

def _extraer_horas_numero(texto: str) -> float:
    if not texto:
        return 0.0
    texto_str = str(texto).strip().lower()
    match = re.search(r'([0-9]+(?:\.[0-9]+)?)', texto_str)
    if match:
        try:
            return float(match.group(1))
        except Exception:
            return 0.0
    return 0.0

@app.get('/api/incidencias')
def listar_incidencias(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None,
    busqueda: Optional[str] = None
):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = 'SELECT * FROM incidencias_docentes WHERE 1=1'
            params = []

            if fecha_inicio:
                query += ' AND fecha >= %s'
                params.append(fecha_inicio)
            if fecha_fin:
                query += ' AND fecha <= %s'
                params.append(fecha_fin)
            if docente:
                query += ' AND docente_nombre LIKE %s'
                params.append(f'%{docente.strip()}%')
            if licenciatura:
                query += ' AND licenciatura = %s'
                params.append(licenciatura.strip())
            if tipo_incidencia:
                query += ' AND tipo_incidencia = %s'
                params.append(tipo_incidencia.strip())
            if busqueda:
                query += ' AND (docente_nombre LIKE %s OR observaciones LIKE %s OR licenciatura LIKE %s OR grado_grupo LIKE %s)'
                p = f'%{busqueda.strip()}%'
                params.extend([p, p, p, p])

            query += ' ORDER BY fecha DESC, id DESC'
            cursor.execute(query, tuple(params))
            filas = cursor.fetchall() or []

            items = []
            total_horas_falta = 0.0
            total_faltas = 0
            total_retardos = 0
            total_salidas_anticipadas = 0
            docentes_set = set()

            for f in filas:
                fecha_val = f['fecha']
                if hasattr(fecha_val, 'strftime'):
                    fecha_str = fecha_val.strftime('%Y-%m-%d')
                else:
                    fecha_str = str(fecha_val)[:10]

                doc_nom = f.get('docente_nombre') or ''
                if doc_nom:
                    docentes_set.add(doc_nom)

                tipo = f.get('tipo_incidencia') or ''
                falta_h = f.get('falta_horas') or ''
                ret = f.get('retardo') or ''
                sal = f.get('salida_anticipada') or ''

                if tipo == 'falta' or (falta_h and str(falta_h).strip()):
                    total_faltas += 1
                    total_horas_falta += _extraer_horas_numero(falta_h)
                if tipo == 'retardo' or (ret and str(ret).strip()):
                    total_retardos += 1
                if tipo == 'salida_anticipada' or (sal and str(sal).strip()):
                    total_salidas_anticipadas += 1

                items.append({
                    'id': f['id'],
                    'fecha': fecha_str,
                    'docente_nombre': doc_nom,
                    'docente_id': f.get('docente_id'),
                    'tipo_incidencia': tipo,
                    'falta_horas': falta_h,
                    'retardo': ret,
                    'salida_anticipada': sal,
                    'licenciatura': f.get('licenciatura') or '',
                    'grado_grupo': f.get('grado_grupo') or '',
                    'asignatura': f.get('asignatura') or '',
                    'aula': f.get('aula') or '',
                    'observaciones': f.get('observaciones') or '',
                    'registrado_por': f.get('registrado_por') or 'Prefectura',
                    'created_at': str(f.get('created_at') or '')
                })

            resumen = {
                'total_incidencias': len(items),
                'total_faltas': total_faltas,
                'total_horas_falta': round(total_horas_falta, 1),
                'total_retardos': total_retardos,
                'total_salidas_anticipadas': total_salidas_anticipadas,
                'docentes_afectados': len(docentes_set)
            }

            return {
                'incidencias': items,
                'resumen': resumen,
                'filtros': {
                    'fecha_inicio': fecha_inicio,
                    'fecha_fin': fecha_fin,
                    'licenciatura': licenciatura,
                    'docente': docente,
                    'tipo_incidencia': tipo_incidencia
                }
            }
    finally:
        connection.close()

@app.post('/api/incidencias')
def crear_incidencia(req: IncidenciaDocente, request: Request):
    if not req.fecha or not req.docente_nombre:
        raise HTTPException(status_code=400, detail='La fecha y el nombre del docente son obligatorios.')

    usuario = obtener_usuario(request)
    registrado_por = usuario if usuario and usuario != 'Sistema' else (req.registrado_por or 'Prefectura')

    falta_horas = req.falta_horas.strip() if req.falta_horas else ''
    if req.tipo_incidencia == 'falta' and not falta_horas:
        falta_horas = '1'

    retardo = req.retardo.strip() if req.retardo else ''
    salida_anticipada = req.salida_anticipada.strip() if req.salida_anticipada else ''

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = '''
INSERT INTO incidencias_docentes 
(fecha, docente_id, docente_nombre, tipo_incidencia, falta_horas, retardo, salida_anticipada, 
 licenciatura, grado_grupo, asignatura, aula, observaciones, registrado_por)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
'''
            cursor.execute(sql, (
                req.fecha,
                req.docente_id,
                req.docente_nombre.strip(),
                req.tipo_incidencia,
                falta_horas,
                retardo,
                salida_anticipada,
                (req.licenciatura or '').strip(),
                (req.grado_grupo or '').strip(),
                (req.asignatura or '').strip(),
                (req.aula or '').strip(),
                (req.observaciones or '').strip(),
                registrado_por
            ))
            nuevo_id = cursor.lastrowid

            try:
                registrar_bitacora(
                    cursor,
                    usuario,
                    'crear_incidencia',
                    'incidencias_docentes',
                    registro_id=nuevo_id,
                    docente=req.docente_nombre,
                    licenciatura=req.licenciatura,
                    grado_cuatrimestre=req.grado_grupo,
                    asignatura=req.asignatura,
                    motivo=f'Tipo: {req.tipo_incidencia}. {req.observaciones or ""}'
                )
            except Exception:
                pass

        connection.commit()
        return {'success': True, 'id': nuevo_id, 'message': 'Incidencia registrada correctamente.'}
    finally:
        connection.close()

@app.put('/api/incidencias/{incidencia_id}')
def actualizar_incidencia(incidencia_id: int, req: IncidenciaDocente, request: Request):
    if not req.fecha or not req.docente_nombre:
        raise HTTPException(status_code=400, detail='La fecha y el nombre del docente son obligatorios.')

    usuario = obtener_usuario(request)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id FROM incidencias_docentes WHERE id = %s', (incidencia_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail='Incidencia no encontrada.')

            sql = '''
UPDATE incidencias_docentes SET
    fecha = %s,
    docente_id = %s,
    docente_nombre = %s,
    tipo_incidencia = %s,
    falta_horas = %s,
    retardo = %s,
    salida_anticipada = %s,
    licenciatura = %s,
    grado_grupo = %s,
    asignatura = %s,
    aula = %s,
    observaciones = %s
WHERE id = %s
'''
            cursor.execute(sql, (
                req.fecha,
                req.docente_id,
                req.docente_nombre.strip(),
                req.tipo_incidencia,
                (req.falta_horas or '').strip(),
                (req.retardo or '').strip(),
                (req.salida_anticipada or '').strip(),
                (req.licenciatura or '').strip(),
                (req.grado_grupo or '').strip(),
                (req.asignatura or '').strip(),
                (req.aula or '').strip(),
                (req.observaciones or '').strip(),
                incidencia_id
            ))

            try:
                registrar_bitacora(
                    cursor,
                    usuario,
                    'actualizar_incidencia',
                    'incidencias_docentes',
                    registro_id=incidencia_id,
                    docente=req.docente_nombre,
                    licenciatura=req.licenciatura,
                    grado_cuatrimestre=req.grado_grupo,
                    asignatura=req.asignatura,
                    motivo=f'Edición de incidencia. {req.observaciones or ""}'
                )
            except Exception:
                pass

        connection.commit()
        return {'success': True, 'message': 'Incidencia actualizada correctamente.'}
    finally:
        connection.close()

@app.delete('/api/incidencias/{incidencia_id}')
def eliminar_incidencia(incidencia_id: int, request: Request):
    usuario = obtener_usuario(request)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT docente_nombre, tipo_incidencia, fecha FROM incidencias_docentes WHERE id = %s', (incidencia_id,))
            ant = cursor.fetchone()
            if not ant:
                raise HTTPException(status_code=404, detail='Incidencia no encontrada.')

            cursor.execute('DELETE FROM incidencias_docentes WHERE id = %s', (incidencia_id,))

            try:
                registrar_bitacora(
                    cursor,
                    usuario,
                    'eliminar_incidencia',
                    'incidencias_docentes',
                    registro_id=incidencia_id,
                    docente=ant.get('docente_nombre'),
                    motivo=f'Eliminación de incidencia de fecha {ant.get("fecha")}'
                )
            except Exception:
                pass

        connection.commit()
        return {'success': True, 'message': 'Incidencia eliminada con éxito.'}
    finally:
        connection.close()

def _generar_excel_incidencias(
    data: dict,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None,
    usuario_nombre: Optional[str] = "Prefectura"
) -> bytes:
    import io
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    incidencias = data.get('incidencias', [])
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Incidencias Docentes'
    ws.views.sheetView[0].showGridLines = True

    # 1. Agregar el escudo oficial de la Universidad Latino en A1
    _agregar_logo_excel(ws)

    # Tipografías y estilos
    title_font = Font(name='Calibri', size=14, bold=True, color='1C355E')
    meta_font = Font(name='Calibri', size=9, italic=True, color='555555')
    font_header = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
    fill_header = PatternFill(start_color='1C355E', end_color='1C355E', fill_type='solid')
    fill_header_sub = PatternFill(start_color='244275', end_color='244275', fill_type='solid')

    font_data = Font(name='Calibri', size=10, color='1E293B')
    font_bold_data = Font(name='Calibri', size=10, bold=True, color='1E293B')

    align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
    align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
    align_right = Alignment(horizontal='right', vertical='center')

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Alturas de las filas de encabezado
    ws.row_dimensions[1].height = 24
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 10

    # Fila 1: Título institucional
    ws.cell(row=1, column=2, value="UNIVERSIDAD LATINO — RELACIÓN DE INCIDENCIAS DOCENTES").font = title_font

    # Fila 2: Metadatos de generación y fecha
    ahora_str = _ahora_local().strftime("%Y-%m-%d %H:%M:%S")
    ws.cell(row=2, column=2, value=f"Generado por: {usuario_nombre} | Fecha y hora: {ahora_str} | Total registros: {len(incidencias)}").font = meta_font

    # Fila 3: Rango de fechas de la relación de incidencias y filtros
    periodo_str = "Relación de incidencias docentes"
    if fecha_inicio and fecha_fin:
        periodo_str += f" del {fecha_inicio} al {fecha_fin}"
    elif fecha_inicio:
        periodo_str += f" a partir del {fecha_inicio}"
    elif fecha_fin:
        periodo_str += f" hasta el {fecha_fin}"
    else:
        periodo_str += " (Registro General)"

    filtros_detalles = []
    if licenciatura:
        filtros_detalles.append(f"Licenciatura: {licenciatura}")
    if tipo_incidencia:
        filtros_detalles.append(f"Tipo: {tipo_incidencia}")
    if docente:
        filtros_detalles.append(f"Docente: {docente}")

    filtros_txt = f" | Filtros: {', '.join(filtros_detalles)}" if filtros_detalles else ""
    ws.cell(row=3, column=2, value=f"{periodo_str}{filtros_txt}").font = meta_font

    # Filas 5 y 6: Encabezados de columnas dobles
    ws.merge_cells('A5:A6')
    ws['A5'] = 'Fecha'
    ws.merge_cells('B5:B6')
    ws['B5'] = 'Nombre'
    ws.merge_cells('C5:E5')
    ws['C5'] = 'INCIDENCIAS'
    ws['C6'] = 'Falta (horas)'
    ws['D6'] = 'Retardo'
    ws['E6'] = 'Salida anticipada'
    ws.merge_cells('F5:F6')
    ws['F5'] = 'Licenciatura / Departamento'
    ws.merge_cells('G5:G6')
    ws['G5'] = 'Grado - grupo'
    ws.merge_cells('H5:H6')
    ws['H5'] = 'Observaciones'

    ws.row_dimensions[5].height = 20
    ws.row_dimensions[6].height = 22

    for row in range(5, 7):
        for col in range(1, 9):
            cell = ws.cell(row=row, column=col)
            cell.font = font_header
            cell.fill = fill_header if row == 5 else fill_header_sub
            cell.alignment = align_center
            cell.border = border_thin

    fila_actual = 7
    fill_zebra = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    fill_white = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')

    for inc in incidencias:
        fill_fila = fill_zebra if fila_actual % 2 == 0 else fill_white
        ws.row_dimensions[fila_actual].height = 24

        c1 = ws.cell(row=fila_actual, column=1, value=inc['fecha'])
        c1.alignment = align_center

        c2 = ws.cell(row=fila_actual, column=2, value=inc['docente_nombre'])
        c2.alignment = align_left
        c2.font = font_bold_data

        c3 = ws.cell(row=fila_actual, column=3, value=inc['falta_horas'] or '')
        c3.alignment = align_center
        if inc['falta_horas']:
            c3.font = Font(name='Calibri', size=10, bold=True, color='B91C1C')

        c4 = ws.cell(row=fila_actual, column=4, value=inc['retardo'] or '')
        c4.alignment = align_center
        if inc['retardo']:
            c4.font = Font(name='Calibri', size=10, bold=True, color='B45309')

        c5 = ws.cell(row=fila_actual, column=5, value=inc['salida_anticipada'] or '')
        c5.alignment = align_center
        if inc['salida_anticipada']:
            c5.font = Font(name='Calibri', size=10, bold=True, color='C2410C')

        c6 = ws.cell(row=fila_actual, column=6, value=inc['licenciatura'] or '')
        c6.alignment = align_center

        c7 = ws.cell(row=fila_actual, column=7, value=inc['grado_grupo'] or '')
        c7.alignment = align_center

        c8 = ws.cell(row=fila_actual, column=8, value=inc['observaciones'] or '')
        c8.alignment = align_left

        for col in range(1, 9):
            cell = ws.cell(row=fila_actual, column=col)
            cell.fill = fill_fila
            cell.border = border_thin
            if not cell.font or cell.font == Font():
                cell.font = font_data

        fila_actual += 1

    # Fila de totales
    ws.row_dimensions[fila_actual].height = 24
    c_tot_label = ws.cell(row=fila_actual, column=2, value='TOTAL REGISTROS:')
    c_tot_label.font = Font(name='Calibri', size=10, bold=True, color='1C355E')
    c_tot_label.alignment = align_right

    res = data.get('resumen', {})
    c_tot_falta = ws.cell(row=fila_actual, column=3, value=f"{res.get('total_horas_falta', 0)} hrs" if res.get('total_horas_falta', 0) > 0 else '')
    c_tot_falta.font = Font(name='Calibri', size=10, bold=True, color='B91C1C')
    c_tot_falta.alignment = align_center

    c_tot_ret = ws.cell(row=fila_actual, column=4, value=f"{res.get('total_retardos', 0)} ret." if res.get('total_retardos', 0) > 0 else '')
    c_tot_ret.font = Font(name='Calibri', size=10, bold=True, color='B45309')
    c_tot_ret.alignment = align_center

    c_tot_sal = ws.cell(row=fila_actual, column=5, value=f"{res.get('total_salidas_anticipadas', 0)} sal." if res.get('total_salidas_anticipadas', 0) > 0 else '')
    c_tot_sal.font = Font(name='Calibri', size=10, bold=True, color='C2410C')
    c_tot_sal.alignment = align_center

    fill_total = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')
    for col in range(1, 9):
        cell = ws.cell(row=fila_actual, column=col)
        cell.fill = fill_total
        cell.border = border_thin

    # Anchos de columnas ajustados
    anchos = {1: 14, 2: 34, 3: 16, 4: 16, 5: 18, 6: 28, 7: 16, 8: 52}
    for col_idx, ancho in anchos.items():
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = ancho

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


def _generar_pdf_incidencias(
    data: dict,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None,
    usuario_nombre: str = "Prefectura"
) -> bytes:
    import io
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    styles = getSampleStyleSheet()

    th_style = ParagraphStyle('IncTh', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.whitesmoke, alignment=1)
    th_sub_falta = ParagraphStyle('IncThFalta', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9, textColor=colors.HexColor('#fca5a5'), alignment=1)
    th_sub_ret = ParagraphStyle('IncThRet', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9, textColor=colors.HexColor('#fde68a'), alignment=1)
    th_sub_sal = ParagraphStyle('IncThSal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9, textColor=colors.HexColor('#fed7aa'), alignment=1)

    td_style = ParagraphStyle('IncTd', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=9.5, textColor=colors.HexColor('#1f2937'))
    td_bold = ParagraphStyle('IncTdBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=colors.HexColor('#111827'))
    td_center = ParagraphStyle('IncTdCenter', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#1f2937'))
    td_falta = ParagraphStyle('IncTdFalta', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#b91c1c'))
    td_ret = ParagraphStyle('IncTdRet', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#b45309'))
    td_sal = ParagraphStyle('IncTdSal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#c2410c'))

    periodo_str = "Corte General Completo"
    if fecha_inicio and fecha_fin:
        periodo_str = f"Período del {fecha_inicio} al {fecha_fin}"
    elif fecha_inicio:
        periodo_str = f"A partir del {fecha_inicio}"
    elif fecha_fin:
        periodo_str = f"Hasta el {fecha_fin}"

    filtros_detalles = []
    if licenciatura: filtros_detalles.append(f"Licenciatura: {licenciatura}")
    if tipo_incidencia: filtros_detalles.append(f"Tipo: {tipo_incidencia}")
    if docente: filtros_detalles.append(f"Docente: {docente}")
    filtros_txt = f" | Filtros: {', '.join(filtros_detalles)}" if filtros_detalles else ""

    ahora_str = _ahora_local().strftime("%d/%m/%Y %H:%M:%S")
    incidencias = data.get('incidencias', [])
    resumen = data.get('resumen', {})

    story = []

    # Encabezado con logo institucional
    header_els = _crear_header_pdf_con_logo(
        styles,
        "UNIVERSIDAD LATINO",
        "RELACIÓN DE INCIDENCIAS DOCENTES",
        f"<b>Período:</b> {periodo_str}{filtros_txt} | <b>Generado por:</b> {usuario_nombre} | <b>Fecha y hora:</b> {ahora_str} | <b>Total registros:</b> {len(incidencias)}"
    )
    story.extend(header_els)
    story.append(Spacer(1, 8))

    # Barra resumen / KPIs
    kpi_p_style = ParagraphStyle('KpiStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#1c355e'))
    kpi_data = [[
        Paragraph(f"<b>Faltas:</b> {resumen.get('total_faltas', 0)} ({resumen.get('total_horas_falta', 0)} hrs)", kpi_p_style),
        Paragraph(f"<b>Retardos:</b> {resumen.get('total_retardos', 0)}", kpi_p_style),
        Paragraph(f"<b>Salidas Anticipadas:</b> {resumen.get('total_salidas_anticipadas', 0)}", kpi_p_style),
        Paragraph(f"<b>Docentes involucrados:</b> {resumen.get('docentes_afectados', 0)}", kpi_p_style),
        Paragraph(f"<b>Total incidencias:</b> {resumen.get('total_incidencias', len(incidencias))}", kpi_p_style)
    ]]
    kpi_table = Table(kpi_data, colWidths=[150, 130, 160, 150, 142])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # Tabla principal
    col_widths = [60, 135, 50, 50, 55, 72, 60, 250]

    table_data = [
        [
            Paragraph("<b>Fecha</b>", th_style),
            Paragraph("<b>Nombre del Docente</b>", th_style),
            Paragraph("<b>INCIDENCIAS</b>", th_style),
            "",
            "",
            Paragraph("<b>Licenciatura</b>", th_style),
            Paragraph("<b>Grado - Gpo</b>", th_style),
            Paragraph("<b>Observaciones</b>", th_style)
        ],
        [
            "",
            "",
            Paragraph("<b>Falta (h)</b>", th_sub_falta),
            Paragraph("<b>Retardo</b>", th_sub_ret),
            Paragraph("<b>Salida ant.</b>", th_sub_sal),
            "",
            "",
            ""
        ]
    ]

    def _formatear_minutos(val):
        if not val or not str(val).strip():
            return "-"
        s = str(val).strip()
        if "min" in s.lower():
            return s
        return f"{s} min"

    def _formatear_horas(val):
        if not val or not str(val).strip():
            return "-"
        s = str(val).strip()
        if "hr" in s.lower():
            return s
        return f"{s} hrs"

    for inc in incidencias:
        falta_h = inc.get('falta_horas') or ''
        ret = inc.get('retardo') or ''
        sal = inc.get('salida_anticipada') or ''

        texto_falta = _formatear_horas(falta_h)
        texto_ret = _formatear_minutos(ret)
        texto_sal = _formatear_minutos(sal)

        table_data.append([
            Paragraph(inc.get('fecha') or '', td_center),
            Paragraph(inc.get('docente_nombre') or '', td_bold),
            Paragraph(texto_falta, td_falta if falta_h else td_center),
            Paragraph(texto_ret, td_ret if ret else td_center),
            Paragraph(texto_sal, td_sal if sal else td_center),
            Paragraph(inc.get('licenciatura') or '-', td_center),
            Paragraph(inc.get('grado_grupo') or '-', td_center),
            Paragraph(inc.get('observaciones') or '-', td_style)
        ])

    # Fila de totales
    tot_label = Paragraph("<b>TOTALES:</b>", ParagraphStyle('TotLbl', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, alignment=2, textColor=colors.HexColor('#1c355e')))
    tot_falta = Paragraph(f"<b>{resumen.get('total_horas_falta', 0)} hrs</b>" if resumen.get('total_horas_falta', 0) > 0 else "-", td_falta)
    tot_ret = Paragraph(f"<b>{resumen.get('total_retardos', 0)} ret.</b>" if resumen.get('total_retardos', 0) > 0 else "-", td_ret)
    tot_sal = Paragraph(f"<b>{resumen.get('total_salidas_anticipadas', 0)} sal.</b>" if resumen.get('total_salidas_anticipadas', 0) > 0 else "-", td_sal)

    table_data.append([
        "",
        tot_label,
        tot_falta,
        tot_ret,
        tot_sal,
        "",
        "",
        ""
    ])

    t_style = [
        ('SPAN', (0, 0), (0, 1)),
        ('SPAN', (1, 0), (1, 1)),
        ('SPAN', (2, 0), (4, 0)),
        ('SPAN', (5, 0), (5, 1)),
        ('SPAN', (6, 0), (6, 1)),
        ('SPAN', (7, 0), (7, 1)),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1c355e')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#244275')),
        ('ALIGN', (0, 0), (-1, 1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]

    total_idx = len(table_data) - 1
    for r in range(2, total_idx):
        if r % 2 == 0:
            t_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#f8fafc')))
        else:
            t_style.append(('BACKGROUND', (0, r), (-1, r), colors.white))

    t_style.append(('BACKGROUND', (0, total_idx), (-1, total_idx), colors.HexColor('#e2e8f0')))
    t_style.append(('LINEABOVE', (0, total_idx), (-1, total_idx), 1, colors.HexColor('#1c355e')))

    main_table = Table(table_data, colWidths=col_widths, repeatRows=2)
    main_table.setStyle(TableStyle(t_style))
    story.append(main_table)
    story.append(Spacer(1, 16))

    # Bloque de firmas institucionales
    sig_title = ParagraphStyle('SigTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, alignment=1, textColor=colors.HexColor('#111827'))
    sig_sub = ParagraphStyle('SigSub', parent=styles['Normal'], fontName='Helvetica', fontSize=7, alignment=1, textColor=colors.HexColor('#64748b'))
    sig_line = Paragraph("_______________________________", ParagraphStyle('Line', parent=styles['Normal'], alignment=1, textColor=colors.HexColor('#1f2937')))

    sig_data = [
        [sig_line],
        [Paragraph("<b>Prefectura de Turno</b>", sig_title)],
        [Paragraph("Elaboró / Reportó", sig_sub)]
    ]
    sig_table = Table(sig_data, colWidths=[732])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    sig_table.keepWithNext = True
    story.append(sig_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


@app.get('/api/incidencias/exportar-excel')
def exportar_incidencias_excel(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None,
    usuario_nombre: Optional[str] = "Prefectura"
):
    data = listar_incidencias(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        docente=docente,
        licenciatura=licenciatura,
        tipo_incidencia=tipo_incidencia
    )

    excel_bytes = _generar_excel_incidencias(
        data=data,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        docente=docente,
        licenciatura=licenciatura,
        tipo_incidencia=tipo_incidencia,
        usuario_nombre=usuario_nombre
    )

    nombre_archivo = f'relacion_incidencias_docentes_{fecha_inicio or "inicio"}_{fecha_fin or "fin"}.xlsx'
    return Response(
        content=excel_bytes,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{nombre_archivo}"'}
    )


@app.get('/api/incidencias/exportar-pdf')
def exportar_incidencias_pdf(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None,
    busqueda: Optional[str] = None,
    usuario_nombre: Optional[str] = "Prefectura"
):
    data = listar_incidencias(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        docente=docente,
        licenciatura=licenciatura,
        tipo_incidencia=tipo_incidencia,
        busqueda=busqueda
    )

    pdf_bytes = _generar_pdf_incidencias(
        data=data,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        docente=docente,
        licenciatura=licenciatura,
        tipo_incidencia=tipo_incidencia,
        usuario_nombre=usuario_nombre or "Prefectura"
    )

    nombre_archivo = f'relacion_incidencias_docentes_{fecha_inicio or "inicio"}_{fecha_fin or "fin"}.pdf'
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'inline; filename="{nombre_archivo}"'}
    )


class ExportarIncidenciasEmailRequest(BaseModel):
    destinatarios: str
    cc: Optional[str] = ""
    cco: Optional[str] = ""
    asunto: Optional[str] = None
    mensaje: Optional[str] = ""
    adjuntar_excel: Optional[bool] = True
    adjuntar_pdf: Optional[bool] = True
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    docente: Optional[str] = None
    licenciatura: Optional[str] = None
    tipo_incidencia: Optional[str] = None
    busqueda: Optional[str] = None
    usuario_nombre: Optional[str] = "Prefectura"
    usuario_correo: Optional[str] = ""


@app.post("/api/incidencias/exportar-email")

def _enviar_smtp(correo_destino: str, asunto: str, html: str):
    """Envía correos usando la API de EmailJS (vía HTTP) para evadir el bloqueo de puertos de Render."""
    import urllib.request, json
    service_id = os.getenv("EMAILJS_SERVICE_ID") or "service_jhpup3s"
    template_id = os.getenv("EMAILJS_TEMPLATE_ID") or "template_zj1opln"
    public_key = os.getenv("EMAILJS_PUBLIC_KEY") or "crMcHqmKfSp3QZ5tL"
    private_key = os.getenv("EMAILJS_PRIVATE_KEY") or "1E9fvAzBxLKtdHfSXPOzv"

    if not service_id or not template_id or not public_key:
        raise ValueError("Faltan las credenciales de EmailJS en las variables de entorno.")

    payload = {
        "service_id": service_id,
        "template_id": template_id,
        "user_id": public_key,
        "accessToken": private_key,
        "template_params": {
            "to_email": correo_destino,
            "asunto": asunto,
            "html_content": html
        }
    }

    req = urllib.request.Request(
        'https://api.emailjs.com/api/v1.0/email/send',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        }
    )
    with urllib.request.urlopen(req, timeout=12.0) as res:
        if res.status != 200:
            raise Exception(f"EmailJS respondió con código HTTP {res.status}")

def exportar_incidencias_email(req: ExportarIncidenciasEmailRequest, request: Request):
    destinos = [d.strip() for d in req.destinatarios.replace(';', ',').split(',') if d.strip()]
    if not destinos:
        raise HTTPException(status_code=400, detail="Debe especificar al menos un correo destinatario.")

    cc_list = [d.strip() for d in (req.cc or '').replace(';', ',').split(',') if d.strip()]
    cco_list = [d.strip() for d in (req.cco or '').replace(';', ',').split(',') if d.strip()]

    data = listar_incidencias(
        fecha_inicio=req.fecha_inicio,
        fecha_fin=req.fecha_fin,
        docente=req.docente,
        licenciatura=req.licenciatura,
        tipo_incidencia=req.tipo_incidencia,
        busqueda=req.busqueda
    )
    incidencias = data.get('incidencias', [])
    resumen = data.get('resumen', {})

    fecha_str = datetime.now().strftime("%Y-%m-%d")
    periodo_str = "Corte General"
    if req.fecha_inicio and req.fecha_fin:
        periodo_str = f"del {req.fecha_inicio} al {req.fecha_fin}"
    elif req.fecha_inicio:
        periodo_str = f"desde {req.fecha_inicio}"
    elif req.fecha_fin:
        periodo_str = f"hasta {req.fecha_fin}"

    filename_pdf = f"Relacion_Incidencias_Docentes_{fecha_str}.pdf"
    filename_xlsx = f"Relacion_Incidencias_Docentes_{fecha_str}.xlsx"

    pdf_bytes = None
    xlsx_bytes = None
    archivos_adjuntos_html = []

    if req.adjuntar_pdf:
        try:
            pdf_bytes = _generar_pdf_incidencias(
                data=data,
                fecha_inicio=req.fecha_inicio,
                fecha_fin=req.fecha_fin,
                docente=req.docente,
                licenciatura=req.licenciatura,
                tipo_incidencia=req.tipo_incidencia,
                usuario_nombre=req.usuario_nombre or "Prefectura"
            )
            archivos_adjuntos_html.append(f"<li>📄 <strong>PDF Oficial:</strong> {filename_pdf}</li>")
        except Exception as e:
            print(f"Error generando PDF de incidencias: {e}")

    if req.adjuntar_excel:
        try:
            xlsx_bytes = _generar_excel_incidencias(
                data=data,
                fecha_inicio=req.fecha_inicio,
                fecha_fin=req.fecha_fin,
                docente=req.docente,
                licenciatura=req.licenciatura,
                tipo_incidencia=req.tipo_incidencia,
                usuario_nombre=req.usuario_nombre or "Prefectura"
            )
            archivos_adjuntos_html.append(f"<li>📊 <strong>Excel (.xlsx):</strong> {filename_xlsx}</li>")
        except Exception as e:
            print(f"Error generando Excel de incidencias: {e}")

    asunto = req.asunto or f"Relación de Incidencias Docentes — Universidad Latino ({periodo_str})"

    lista_adjuntos_str = "".join(archivos_adjuntos_html) if archivos_adjuntos_html else "<li>Ningún archivo adjunto</li>"

    body_html = f'''
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; background-color: #f4f6fb; padding: 20px;">
        <div style="max-width: 650px; margin: 0 auto; background: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e0e6ed; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="border-bottom: 2px solid #1c355e; padding-bottom: 14px; margin-bottom: 18px;">
                <h2 style="color: #1c355e; margin: 0; font-size: 20px;">
                    UNIVERSIDAD LATINO — SIPREF
                </h2>
                <p style="color: #d97706; font-weight: bold; margin: 4px 0 0 0; font-size: 13px;">
                    Relación de Incidencias Docentes ({periodo_str})
                </p>
            </div>
            
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                {req.mensaje or 'Se adjunta el reporte oficial de incidencias docentes generado desde el sistema institucional.'}
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr style="background: #1c355e; color: #ffffff;">
                    <th colspan="2" style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase;">Resumen del Período</th>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Total de Incidencias:</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">{len(incidencias)} registros</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Faltas acumuladas:</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #b91c1c;">{resumen.get('total_faltas', 0)} ({resumen.get('total_horas_falta', 0)} hrs)</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Retardos / Salidas ant.:</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #b45309;">{resumen.get('total_retardos', 0)} retardos | {resumen.get('total_salidas_anticipadas', 0)} salidas</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; color: #64748b;">Docentes involucrados:</td>
                    <td style="padding: 8px 12px; font-weight: bold; color: #1c355e;">{resumen.get('docentes_afectados', 0)} profesores</td>
                </tr>
            </table>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
                <p style="margin: 0; color: #166534; font-size: 13px; font-weight: bold;">
                    📎 Archivo(s) adjunto(s) en este correo:
                </p>
                <ul style="margin: 6px 0 0 0; padding-left: 20px; color: #15803d; font-size: 12px; line-height: 1.6;">
                    {lista_adjuntos_str}
                </ul>
                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 11px;">
                    Los archivos solicitados se encuentran directamente adjuntos en este mensaje para su descarga directa.
                </p>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Reporte emitido por <strong>{req.usuario_nombre}</strong> el {datetime.now().strftime('%d/%m/%Y %H:%M')}.<br/>
                Sistema de Control y Gestión Escolar — Universidad Latino.
            </p>
        </div>
    </body>
    </html>
    '''

    sender_email = (os.getenv("SMTP_USER", "").strip() or "soporte.sipref.software@gmail.com")
    smtp_host = (os.getenv("SMTP_HOST", "").strip() or "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_pass = (os.getenv("SMTP_PASSWORD", "") or os.getenv("SMTP_PASS", "") or "from lcxt muzd wugb").strip()

    enviado_exitoso = False
    error_smtp = None

    if sender_email and smtp_pass:
        try:
            from email.mime.base import MIMEBase
            from email import encoders

            msg = MIMEMultipart()
            msg['From'] = f"SIPREF Incidencias <{sender_email}>"
            msg['To'] = ", ".join(destinos)
            if cc_list:
                msg['Cc'] = ", ".join(cc_list)
            msg['Subject'] = asunto
            msg.attach(MIMEText(body_html, 'html'))

            if pdf_bytes:
                part = MIMEBase('application', 'pdf')
                part.set_payload(pdf_bytes)
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename="{filename_pdf}"')
                msg.attach(part)

            if xlsx_bytes:
                part = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                part.set_payload(xlsx_bytes)
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f'attachment; filename="{filename_xlsx}"')
                msg.attach(part)

            all_recipients = list(destinos) + list(cc_list) + list(cco_list)
            # Timeout corto (4s) para detectar rápidamente si Render bloquea el puerto SMTP
            with smtplib.SMTP(smtp_host, smtp_port, timeout=4.0) as server:
                server.starttls()
                server.login(sender_email, smtp_pass)
                server.sendmail(sender_email, all_recipients, msg.as_string())
            enviado_exitoso = True
            print("Reporte de incidencias enviado exitosamente vía SMTP directo.")
        except Exception as e:
            error_smtp = str(e)
            print(f"SMTP directo no disponible o bloqueado en la nube ({e}). Intentando fallback HTTP vía EmailJS...")

    # Si SMTP no funcionó (común en Render por bloqueo de puertos 587/465), enviar vía EmailJS (puerto 443 HTTPS)
    if not enviado_exitoso:
        try:
            all_recipients = list(destinos) + list(cc_list) + list(cco_list)
            for dest in all_recipients:
                _enviar_smtp(dest, asunto, body_html)
            enviado_exitoso = True
            print("Reporte de incidencias enviado exitosamente vía EmailJS HTTP fallback.")
        except Exception as e_fb:
            print(f"Error en fallback EmailJS: {e_fb}")
            raise HTTPException(
                status_code=500,
                detail=f"No se pudo enviar el correo por SMTP ({error_smtp or 'puerto bloqueado'}) ni por EmailJS ({e_fb})."
            )

    try:
        _registrar_auditoria_exportacion(
            usuario_nombre=req.usuario_nombre,
            usuario_correo=req.usuario_correo,
            tipo="incidencias_email",
            es_historial=False,
            filtros={"fecha_inicio": req.fecha_inicio, "fecha_fin": req.fecha_fin, "docente": req.docente, "licenciatura": req.licenciatura, "tipo": req.tipo_incidencia},
            cantidad=len(incidencias),
            enviado_email=True,
            destinatarios=", ".join(destinos)
        )
    except Exception:
        pass

    return {
        "message": f"Reporte de incidencias enviado exitosamente a {len(destinos)} destinatario(s)",
        "destinatarios": len(destinos)
    }


@app.get('/api/incidencias/exportar-csv')
def exportar_incidencias_csv(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None
):
    import csv
    import io

    data = listar_incidencias(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        docente=docente,
        licenciatura=licenciatura,
        tipo_incidencia=tipo_incidencia
    )
    incidencias = data['incidencias']

    periodo_str = 'Relación de incidencias docentes'
    if fecha_inicio and fecha_fin:
        periodo_str += f' del {fecha_inicio} al {fecha_fin}'

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(['UNIVERSIDAD  LATINO', '', '', '', '', '', '', ''])
    writer.writerow([periodo_str, '', '', '', '', '', '', ''])
    writer.writerow(['', '', '', '', '', '', '', ''])
    writer.writerow(['Fecha', 'Nombre', 'INCIDENCIAS', '', '', 'Licenciatura / Departamento', 'Grado - grupo', 'Observaciones'])
    writer.writerow(['', '', 'Falta (horas)', 'Retardo', 'Salida anticipada', '', '', ''])

    for inc in incidencias:
        writer.writerow([
            inc['fecha'],
            inc['docente_nombre'],
            inc['falta_horas'] or '',
            inc['retardo'] or '',
            inc['salida_anticipada'] or '',
            inc['licenciatura'] or '',
            inc['grado_grupo'] or '',
            inc['observaciones'] or ''
        ])

    csv_bytes = output.getvalue().encode('utf-8-sig')
    nombre_archivo = f'relacion_incidencias_{fecha_inicio or "inicio"}_{fecha_fin or "fin"}.csv'

    return Response(
        content=csv_bytes,
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{nombre_archivo}"'}
    )
