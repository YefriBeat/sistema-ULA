import re
import codecs

def update_main():
    with codecs.open('main.py', 'r', 'utf-8') as f:
        content = f.read()
        
    helper_code = """
import difflib
def _asignar_docentes_a_examenes(cursor, datos):
    cursor.execute("SELECT asignatura, docente, licenciatura FROM horarios")
    horarios_all = cursor.fetchall()
    
    horarios_por_carrera = {}
    for h in horarios_all:
        c = (h['licenciatura'] or '').strip()
        if c not in horarios_por_carrera:
            horarios_por_carrera[c] = []
        horarios_por_carrera[c].append(h)

    for d in datos:
        d['docente'] = 'Sin asignar'
        carrera = (d.get('carrera') or '').strip()
        if carrera in horarios_por_carrera:
            materia_limpia = (d.get('materia') or '').lower().strip()
            asignaturas_nombres = list(set([h['asignatura'] for h in horarios_por_carrera[carrera] if h.get('asignatura')]))
            matches = difflib.get_close_matches(materia_limpia, [a.lower().strip() for a in asignaturas_nombres], n=1, cutoff=0.7)
            if matches:
                match_str = matches[0]
                for h in horarios_por_carrera[carrera]:
                    if (h.get('asignatura') or '').lower().strip() == match_str:
                        d['docente'] = h.get('docente') or 'Sin asignar'
                        break
    return datos

"""

    # Add helper code right before exportar_examenes_excel
    if "_asignar_docentes_a_examenes" not in content:
        content = content.replace("# ── EXPORTAR EXÁMENES A EXCEL ──────────────────────────────────────────", helper_code + "\n# ── EXPORTAR EXÁMENES A EXCEL ──────────────────────────────────────────")
    
    # 1. Update exportar_examenes_excel
    excel_start = content.find('@app.get("/api/examenes-calendario/exportar/excel")')
    excel_end = content.find('return Response(content=output.getvalue()', excel_start)
    excel_end = content.find('\n', excel_end) + 1
    
    new_excel_code = """@app.get("/api/examenes-calendario/exportar/excel")
def exportar_examenes_excel(
    carrera: str = "",
    ciclo_escolar: str = "2025-2026",
    fecha_filtro: str = ""
):
    \"\"\"Exporta los exámenes de una carrera a un archivo Excel con estilos profesionales.\"\"\"
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = "SELECT carrera, periodo, semestre, dia, fecha, materia FROM examenes_calendario WHERE ciclo_escolar = %s"
            params = [ciclo_escolar]

            if carrera:
                lista_carreras = [c.strip() for c in carrera.split(',') if c.strip()]
                if lista_carreras:
                    placeholders = ','.join(['%s'] * len(lista_carreras))
                    query += f" AND carrera IN ({placeholders})"
                    params.extend(lista_carreras)

            if fecha_filtro:
                query += " AND LOWER(fecha) LIKE %s"
                params.append(f"%{fecha_filtro.lower()}%")

            query += " ORDER BY carrera, periodo, semestre, id"
            cursor.execute(query, params)
            datos = cursor.fetchall()

            if not datos:
                raise HTTPException(status_code=404, detail="No se encontraron exámenes con esos filtros.")
                
            datos = _asignar_docentes_a_examenes(cursor, datos)

            wb = Workbook()
            ws = wb.active
            titulo_carrera = carrera if carrera else "Todas las carreras"
            ws.title = f"Exámenes {titulo_carrera}"

            # Estilos
            header_font = Font(name='Calibri', bold=True, color='FFFFFF', size=11)
            header_fill = PatternFill(start_color='1C355E', end_color='1C355E', fill_type='solid')
            header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
            thin_border = Border(
                left=Side(style='thin', color='D0D0D0'),
                right=Side(style='thin', color='D0D0D0'),
                top=Side(style='thin', color='D0D0D0'),
                bottom=Side(style='thin', color='D0D0D0')
            )
            title_font = Font(name='Calibri', bold=True, size=14, color='1C355E')
            subtitle_font = Font(name='Calibri', size=10, color='666666')

            # Título
            ws.merge_cells('A1:G1')
            ws['A1'] = f"Calendario de Exámenes — {titulo_carrera}"
            ws['A1'].font = title_font
            ws['A1'].alignment = Alignment(horizontal='center', vertical='center')

            ws.merge_cells('A2:G2')
            ws['A2'] = f"Ciclo Escolar: {ciclo_escolar}" + (f"  |  Filtro de fecha: {fecha_filtro}" if fecha_filtro else "")
            ws['A2'].font = subtitle_font
            ws['A2'].alignment = Alignment(horizontal='center')

            # Encabezados
            headers = ['Carrera', 'Periodo', 'Semestre', 'Día', 'Fecha', 'Materia', 'Docente']
            for col_idx, h in enumerate(headers, 1):
                cell = ws.cell(row=4, column=col_idx, value=h)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
                cell.border = thin_border

            # Datos
            alt_fill = PatternFill(start_color='F4F6FB', end_color='F4F6FB', fill_type='solid')
            for i, row in enumerate(datos):
                row_idx = i + 5
                values = [
                    row.get('carrera', ''),
                    row.get('periodo', ''),
                    row.get('semestre', ''),
                    row.get('dia', ''),
                    row.get('fecha', ''),
                    row.get('materia', ''),
                    row.get('docente', '')
                ]
                for col_idx, val in enumerate(values, 1):
                    cell = ws.cell(row=row_idx, column=col_idx, value=val)
                    cell.font = Font(name='Calibri', size=10)
                    cell.border = thin_border
                    cell.alignment = Alignment(vertical='center')
                    if i % 2 == 1:
                        cell.fill = alt_fill

            # Ajustar ancho de columnas
            col_widths = [12, 25, 15, 15, 22, 45, 30]
            for i, w in enumerate(col_widths, 1):
                ws.column_dimensions[get_column_letter(i)].width = w

            output = io.BytesIO()
            wb.save(output)
            output.seek(0)

            safe_name = carrera if carrera else "Todas"
            filename = f"Examenes_{safe_name}_{ciclo_escolar}.xlsx"

            return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})
"""
    content = content[:excel_start] + new_excel_code + content[excel_end:]

    # 2. Update enviar_examenes_por_correo
    email_start = content.find('@app.post("/api/examenes-calendario/enviar-correo")')
    email_end = content.find('return {"message": f"Correo enviado exitosamente a {correo}"}', email_start)
    email_end = content.find('\n', email_end) + 1
    
    new_email_code = """@app.post("/api/examenes-calendario/enviar-correo")
async def enviar_examenes_por_correo(body: dict):
    \"\"\"Envía los exámenes filtrados por correo electrónico.\"\"\"
    correo = body.get("correo", "").strip()
    carrera = body.get("carrera", "")
    ciclo_escolar = body.get("ciclo_escolar", "2025-2026")
    fecha_filtro = body.get("fecha_filtro", "")

    if not correo or "@" not in correo:
        raise HTTPException(status_code=400, detail="Correo electrónico inválido.")

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = "SELECT carrera, periodo, semestre, dia, fecha, materia FROM examenes_calendario WHERE ciclo_escolar = %s"
            params = [ciclo_escolar]
            if carrera:
                lista_carreras = [c.strip() for c in carrera.split(',') if c.strip()]
                if lista_carreras:
                    placeholders = ','.join(['%s'] * len(lista_carreras))
                    query += f" AND carrera IN ({placeholders})"
                    params.extend(lista_carreras)
            if fecha_filtro:
                query += " AND LOWER(fecha) LIKE %s"
                params.append(f"%{fecha_filtro.lower()}%")
            query += " ORDER BY carrera, periodo, semestre, id"
            cursor.execute(query, params)
            datos = cursor.fetchall()
            
            if not datos:
                raise HTTPException(status_code=404, detail="No se encontraron exámenes con esos filtros.")
                
            datos = _asignar_docentes_a_examenes(cursor, datos)

        titulo_carrera = carrera if carrera else "Todas las carreras"

        # Construir tabla HTML para el correo
        filas_html = ""
        for i, d in enumerate(datos):
            bg = "#ffffff" if i % 2 == 0 else "#f9fafb"
            filas_html += f\"\"\"<tr style="background-color: {bg};">
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">{d.get('periodo','')}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">{d.get('semestre','')}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">{d.get('fecha','')}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;font-weight:500;">{d.get('materia','')}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;">{d.get('docente','')}</td>
            </tr>\"\"\"

        html = f\"\"\"
        <html><body style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;background-color:#f3f4f6;padding:40px 20px;margin:0;">
          <div style="max-width:800px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="background-color:#1c355e;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Calendario de Exámenes — {titulo_carrera}</h1>
              <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Ciclo Escolar: {ciclo_escolar}{' | Filtro: ' + fecha_filtro if fecha_filtro else ''}</p>
            </div>
            <div style="padding:40px;">
              <p style="color:#374151;font-size:15px;margin-bottom:20px;border-left:4px solid #10b981;padding-left:12px;">Se encontraron <strong>{len(datos)}</strong> exámenes programados según los filtros seleccionados.</p>
              
              <div style="overflow-x:auto;">
                  <table style="width:100%;border-collapse:collapse;margin-top:10px;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px #e5e7eb;">
                    <thead>
                      <tr style="background-color:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <th style="padding:12px;color:#475569;font-size:13px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Periodo</th>
                        <th style="padding:12px;color:#475569;font-size:13px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Semestre</th>
                        <th style="padding:12px;color:#475569;font-size:13px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Fecha</th>
                        <th style="padding:12px;color:#475569;font-size:13px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Materia</th>
                        <th style="padding:12px;color:#475569;font-size:13px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Docente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas_html}
                    </tbody>
                  </table>
              </div>
              
              <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">
                  Este es un mensaje automático generado por <strong>SIPREF</strong><br/>
                  Universidad Latino
                </p>
              </div>
            </div>
          </div>
        </body></html>
        \"\"\"

        _enviar_smtp(correo, f"Exámenes {titulo_carrera} — Ciclo {ciclo_escolar}", html)
        return {"message": f"Correo enviado exitosamente a {correo}"}
"""
    content = content[:email_start] + new_email_code + content[email_end:]

    # 3. Add PDF endpoint
    pdf_endpoint = """
@app.get("/api/examenes-calendario/exportar/pdf")
def exportar_examenes_pdf(
    carrera: str = "",
    ciclo_escolar: str = "2025-2026",
    fecha_filtro: str = ""
):
    \"\"\"Exporta los exámenes de una carrera a un archivo PDF.\"\"\"
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = "SELECT carrera, periodo, semestre, dia, fecha, materia FROM examenes_calendario WHERE ciclo_escolar = %s"
            params = [ciclo_escolar]

            if carrera:
                lista_carreras = [c.strip() for c in carrera.split(',') if c.strip()]
                if lista_carreras:
                    placeholders = ','.join(['%s'] * len(lista_carreras))
                    query += f" AND carrera IN ({placeholders})"
                    params.extend(lista_carreras)

            if fecha_filtro:
                query += " AND LOWER(fecha) LIKE %s"
                params.append(f"%{fecha_filtro.lower()}%")

            query += " ORDER BY carrera, periodo, semestre, id"
            cursor.execute(query, params)
            datos = cursor.fetchall()

            if not datos:
                raise HTTPException(status_code=404, detail="No se encontraron exámenes con esos filtros.")
                
            datos = _asignar_docentes_a_examenes(cursor, datos)

            titulo_carrera = carrera if carrera else "Todas las carreras"

            output = io.BytesIO()
            doc = SimpleDocTemplate(output, pagesize=landscape(letter), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
            elements = []
            
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(name="CustomTitle", parent=styles['Heading1'], alignment=1, textColor=colors.HexColor("#1c355e"), fontSize=16)
            subtitle_style = ParagraphStyle(name="CustomSubtitle", parent=styles['Normal'], alignment=1, textColor=colors.gray, fontSize=11, spaceAfter=20)
            
            elements.append(Paragraph(f"Calendario de Exámenes — {titulo_carrera}", title_style))
            subtitle = f"Ciclo Escolar: {ciclo_escolar}"
            if fecha_filtro:
                subtitle += f"  |  Filtro de fecha: {fecha_filtro}"
            elements.append(Paragraph(subtitle, subtitle_style))

            table_data = [['Carrera', 'Periodo', 'Semestre', 'Fecha', 'Materia', 'Docente']]
            
            for row in datos:
                # Use Paragraph for materia and docente to allow wrapping
                p_materia = Paragraph(row.get('materia', ''), styles['Normal'])
                p_docente = Paragraph(row.get('docente', ''), styles['Normal'])
                
                table_data.append([
                    row.get('carrera', ''),
                    row.get('periodo', ''),
                    row.get('semestre', ''),
                    f"{row.get('dia','')} {row.get('fecha','')}",
                    p_materia,
                    p_docente
                ])

            t = Table(table_data, colWidths=[60, 100, 70, 110, 210, 180])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1c355e")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e5e7eb")),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            # Alternate row colors
            for i in range(1, len(table_data)):
                if i % 2 == 0:
                    t.setStyle(TableStyle([('BACKGROUND', (0, i), (-1, i), colors.HexColor("#f9fafb"))]))
            
            elements.append(t)
            doc.build(elements)
            
            output.seek(0)
            safe_name = carrera if carrera else "Todas"
            filename = f"Examenes_{safe_name}_{ciclo_escolar}.pdf"

            return Response(content=output.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al exportar a PDF: {str(e)}")
    finally:
        connection.close()
"""
    
    # Add PDF endpoint right after excel endpoint
    excel_end = content.find('@app.post("/api/examenes-calendario/enviar-correo")')
    content = content[:excel_end] + pdf_endpoint + "\n\n" + content[excel_end:]

    with codecs.open('main.py', 'w', 'utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_main()
    print("main.py updated successfully!")
