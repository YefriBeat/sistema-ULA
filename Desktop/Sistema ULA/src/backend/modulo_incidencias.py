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

@app.get('/api/incidencias/exportar-excel')
def exportar_incidencias_excel(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    docente: Optional[str] = None,
    licenciatura: Optional[str] = None,
    tipo_incidencia: Optional[str] = None
):
    import io
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    data = listar_incidencias(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        docente=docente,
        licenciatura=licenciatura,
        tipo_incidencia=tipo_incidencia
    )
    incidencias = data['incidencias']

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Incidencias Docentes'
    ws.views.sheetView[0].showGridLines = True

    color_primario = '1C355E'    # Azul institucional ULA
    color_subtitulo = '244275'

    font_institucional = Font(name='Calibri', size=16, bold=True, color='FFFFFF')
    fill_institucional = PatternFill(start_color=color_primario, end_color=color_primario, fill_type='solid')

    font_subtitulo = Font(name='Calibri', size=11, bold=True, color='1C355E')
    fill_subtitulo = PatternFill(start_color='E8EFF8', end_color='E8EFF8', fill_type='solid')

    font_header = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
    fill_header = PatternFill(start_color=color_subtitulo, end_color=color_subtitulo, fill_type='solid')
    fill_header_sub = PatternFill(start_color='33589B', end_color='33589B', fill_type='solid')

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

    # Fila 1: UNIVERSIDAD LATINO
    ws.merge_cells('A1:H1')
    ws['A1'] = 'UNIVERSIDAD  LATINO'
    ws['A1'].font = font_institucional
    ws['A1'].fill = fill_institucional
    ws['A1'].alignment = align_center
    ws.row_dimensions[1].height = 34

    # Fila 2: Subtítulo
    periodo_str = 'Relación de incidencias docentes'
    if fecha_inicio and fecha_fin:
        periodo_str += f' del {fecha_inicio} al {fecha_fin}'
    elif fecha_inicio:
        periodo_str += f' a partir del {fecha_inicio}'
    elif fecha_fin:
        periodo_str += f' hasta el {fecha_fin}'
    else:
        periodo_str += ' (Registro General)'

    ws.merge_cells('A2:H2')
    ws['A2'] = periodo_str
    ws['A2'].font = font_subtitulo
    ws['A2'].fill = fill_subtitulo
    ws['A2'].alignment = align_center
    ws.row_dimensions[2].height = 22

    # Fila 3: Espacio
    ws.row_dimensions[3].height = 10

    # Filas 4 y 5: Encabezados dobles exactamente como el formato del usuario
    ws.merge_cells('A4:A5')
    ws['A4'] = 'Fecha'
    ws.merge_cells('B4:B5')
    ws['B4'] = 'Nombre'
    ws.merge_cells('C4:E4')
    ws['C4'] = 'INCIDENCIAS'
    ws['C5'] = 'Falta (horas)'
    ws['D5'] = 'Retardo'
    ws['E5'] = 'Salida anticipada'
    ws.merge_cells('F4:F5')
    ws['F4'] = 'Licenciatura / Departamento'
    ws.merge_cells('G4:G5')
    ws['G4'] = 'Grado - grupo'
    ws.merge_cells('H4:H5')
    ws['H4'] = 'Observaciones'

    ws.row_dimensions[4].height = 20
    ws.row_dimensions[5].height = 22

    for row in range(4, 6):
        for col in range(1, 9):
            cell = ws.cell(row=row, column=col)
            cell.font = font_header
            cell.fill = fill_header if row == 4 else fill_header_sub
            cell.alignment = align_center
            cell.border = border_thin

    fila_actual = 6
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

    res = data['resumen']
    c_tot_falta = ws.cell(row=fila_actual, column=3, value=f"{res['total_horas_falta']} hrs" if res['total_horas_falta'] > 0 else '')
    c_tot_falta.font = Font(name='Calibri', size=10, bold=True, color='B91C1C')
    c_tot_falta.alignment = align_center

    c_tot_ret = ws.cell(row=fila_actual, column=4, value=f"{res['total_retardos']} ret." if res['total_retardos'] > 0 else '')
    c_tot_ret.font = Font(name='Calibri', size=10, bold=True, color='B45309')
    c_tot_ret.alignment = align_center

    c_tot_sal = ws.cell(row=fila_actual, column=5, value=f"{res['total_salidas_anticipadas']} sal." if res['total_salidas_anticipadas'] > 0 else '')
    c_tot_sal.font = Font(name='Calibri', size=10, bold=True, color='C2410C')
    c_tot_sal.alignment = align_center

    fill_total = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')
    for col in range(1, 9):
        cell = ws.cell(row=fila_actual, column=col)
        cell.fill = fill_total
        cell.border = border_thin

    anchos = {1: 14, 2: 34, 3: 16, 4: 16, 5: 18, 6: 28, 7: 16, 8: 52}
    for col_idx, ancho in anchos.items():
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = ancho

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    nombre_archivo = f'relacion_incidencias_docentes_{fecha_inicio or "inicio"}_{fecha_fin or "fin"}.xlsx'
    return Response(
        content=buf.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{nombre_archivo}"'}
    )

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
