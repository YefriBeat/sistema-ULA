import re

MESES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
}

def clasificar_evento(descripcion: str):
    desc_lower = descripcion.lower()
    if 'inhábil' in desc_lower or 'inhabil' in desc_lower: return 'inhabil', True
    elif 'vacaciones' in desc_lower: return 'vacaciones', True
    elif 'extraordinario' in desc_lower and 'inscripci' in desc_lower: return 'inscripcion', False
    elif 'extraordinario' in desc_lower: return 'examen_extraordinario', False
    elif 'examen parcial' in desc_lower or ('parcial' in desc_lower and 'examen' not in desc_lower.replace('parcial','')): return 'examen_parcial', False
    elif 'parcial' in desc_lower: return 'examen_parcial', False
    elif 'ordinario' in desc_lower or 'exámenes finales' in desc_lower: return 'examen_ordinario', False
    elif 'inscripci' in desc_lower: return 'inscripcion', False
    elif 'evaluación docente' in desc_lower or 'evaluacion docente' in desc_lower: return 'evaluacion', False
    elif 'inicio de subciclo' in desc_lower or 'inicio de periodo' in desc_lower or 'inicio de cuatrimestre' in desc_lower: return 'inicio_periodo', False
    elif 'fin de periodo' in desc_lower or 'fin de subciclo' in desc_lower or 'fin de cuatrimestre' in desc_lower: return 'fin_periodo', False
    elif 'entrega' in desc_lower: return 'entrega', False
    elif 'inducción' in desc_lower or 'induccion' in desc_lower: return 'induccion', False
    elif 'junta' in desc_lower: return 'otro', False
    elif 'inicio' in desc_lower: return 'inicio_periodo', False
    else: return 'otro', False

def parse_text_format(text, plan, anio_base, anio_siguiente, periodo):
    eventos_crudos = []
    
    # We find the section "clave de colores empleados:"
    idx = text.lower().find("clave de colores empleados:")
    if idx == -1:
        return []
    
    lineas = text[idx:].split('\n')[1:] # Skip the header
    
    for linea in lineas:
        linea = linea.strip()
        if not linea: continue
        
        # Formato: "Actividad: fechas"
        if ':' not in linea: continue
        partes = linea.split(':', 1)
        actividad_base = partes[0].strip()
        fechas_str = partes[1].strip()
        
        # Some lines have multiple separated by "/" e.g., Exámenes parciales: 1ro., 28 de septiembre al 5 de octubre. / 2do., 3 al 10 de noviembre
        sub_eventos = fechas_str.split('/')
        for sub_ev in sub_eventos:
            sub_ev = sub_ev.strip()
            if not sub_ev: continue
            
            # The activity name might need modification if it's "1ro., 28 de septiembre..."
            actividad = actividad_base
            if '1ro.' in sub_ev: actividad = "Primer " + actividad.lower()
            elif '2do.' in sub_ev: actividad = "Segundo " + actividad.lower()
            
            # Extract all dates from sub_ev
            # A date looks like "DD al DD de Mes" or "DD de Mes" or "DD, DD de Mes"
            # It's better to just find all Month names and numbers before them
            
            # Let's extract the month
            mes_str = None
            mes_num = None
            for m in MESES:
                if m in sub_ev.lower():
                    mes_str = m
                    mes_num = MESES[m]
                    break
            
            if not mes_num:
                continue
                
            anio_mes = anio_base if mes_num >= 8 else anio_siguiente # rough approximation, we will refine
            
            # Find numbers
            numeros = [int(n) for n in re.findall(r'\b\d{1,2}\b', sub_ev) if 1 <= int(n) <= 31]
            if not numeros: continue
            
            # If it's a range "al" or "a" or "-"
            if ' al ' in sub_ev.lower() or ' a ' in sub_ev.lower() or '-' in sub_ev or '–' in sub_ev:
                if len(numeros) >= 2:
                    dia_ini = numeros[0]
                    dia_fin = numeros[1]
                    # what if the month changes? "28 de septiembre al 5 de octubre"
                    mes_ini = mes_num
                    mes_fin = mes_num
                    # Try to find two months
                    meses_found = [m for m in MESES if m in sub_ev.lower()]
                    if len(meses_found) == 2:
                        mes_ini = MESES[meses_found[0]]
                        mes_fin = MESES[meses_found[1]]
                    
                    fecha_inicio = f"{anio_base if mes_ini>=8 else anio_siguiente}-{mes_ini:02d}-{dia_ini:02d}"
                    fecha_fin = f"{anio_base if mes_fin>=8 else anio_siguiente}-{mes_fin:02d}-{dia_fin:02d}"
                    tipo, susp = clasificar_evento(actividad)
                    eventos_crudos.append((plan, f"{anio_base}-{anio_siguiente}", periodo, tipo, actividad, fecha_inicio, fecha_fin, 1 if susp else 0))
            else:
                # Multiple individual dates (e.g. "01, 08, 09 de febrero") or single date ("17 de agosto")
                for dia in numeros:
                    fecha = f"{anio_base if mes_num>=8 else anio_siguiente}-{mes_num:02d}-{dia:02d}"
                    tipo, susp = clasificar_evento(actividad)
                    eventos_crudos.append((plan, f"{anio_base}-{anio_siguiente}", periodo, tipo, actividad, fecha, fecha, 1 if susp else 0))
                    
    return eventos_crudos

text1 = """Clave de colores empleados:
Entrega plan de actividades Sep26-Ene27: 03 de agosto
Entrega de listas y plantillas de maestros para el 1er cuatrimestre Sep 2026-enero 2027: 17 de agosto de 2026
Semana de inducción: 24 al 28 de agosto
Inicio de periodo escolar: 31 de agosto
Inhábil: 16 de septiembre, 02, 16 de noviembre y 25 de diciembre
Exámenes parciales: 1ro., 28 de septiembre al 5 de octubre. / 2do., 3 al 10 de noviembre
Evaluación docente 26 al 29 de oct: 26 ISC. / 27 LNI. / 28 LD. / 29 LVM.
"""

print(parse_text_format(text1, 'cuatrimestral', 2026, 2027, 3))
