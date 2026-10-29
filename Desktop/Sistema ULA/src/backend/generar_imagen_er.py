# -*- coding: utf-8 -*-
"""
Generador visual del Diagrama Entidad-Relación (ER) del Sistema ULA (SIPREF).
Genera un diagrama gráfico de alta resolución en formato PNG para ser incrustado en el PDF.
"""

import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

def generar_diagrama_er(output_png: str):
    fig, ax = plt.subplots(figsize=(16, 11), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")
    fig.patch.set_facecolor("#ffffff")
    ax.set_facecolor("#ffffff")

    # Domain color palettes
    c_user = "#1c355e"      # Navy
    c_doc = "#0f766e"       # Teal
    c_aula = "#4338ca"      # Indigo
    c_hor = "#1d4ed8"       # Blue
    c_ev = "#7e22ce"        # Purple
    c_cal = "#b45309"       # Amber
    c_aud = "#334155"       # Slate

    def draw_entity(x, y, w, h, title, fields, header_color):
        # Card shadow
        shadow = patches.FancyBboxPatch(
            (x + 0.4, y - 0.4), w, h,
            boxstyle="round,pad=0.2,rounding_size=0.8",
            facecolor="#e2e8f0", edgecolor="none", zorder=1
        )
        ax.add_patch(shadow)

        # Main box
        box = patches.FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0.2,rounding_size=0.8",
            facecolor="#ffffff", edgecolor="#cbd5e1", linewidth=1.2, zorder=2
        )
        ax.add_patch(box)

        # Header box
        header_h = 2.4
        hdr = patches.FancyBboxPatch(
            (x, y + h - header_h), w, header_h,
            boxstyle="round,pad=0.1,rounding_size=0.6",
            facecolor=header_color, edgecolor=header_color, zorder=3
        )
        ax.add_patch(hdr)

        # Entity Title
        ax.text(
            x + w / 2, y + h - header_h / 2, title,
            ha="center", va="center", color="#ffffff",
            fontsize=8.5, fontweight="bold", zorder=4
        )

        # Fields
        cur_y = y + h - header_h - 1.0
        line_gap = (h - header_h - 1.2) / max(len(fields), 1)
        for f in fields:
            is_pk = "[PK]" in f
            is_fk = "[FK]" in f
            
            if is_pk:
                prefix = "PK "
                color = "#b91c1c"
                weight = "bold"
            elif is_fk:
                prefix = "FK "
                color = "#0369a1"
                weight = "bold"
            else:
                prefix = "   "
                color = "#334155"
                weight = "normal"

            clean_text = f.replace("[PK]", "").replace("[FK]", "").strip()

            # Prefix badge
            ax.text(
                x + 0.8, cur_y, prefix,
                ha="left", va="center", color=color,
                fontsize=6.5, fontweight="bold", fontfamily="monospace", zorder=4
            )
            # Field name and type
            ax.text(
                x + 2.4, cur_y, clean_text,
                ha="left", va="center", color=color if (is_pk or is_fk) else "#1e293b",
                fontsize=6.5, fontweight=weight, zorder=4
            )
            cur_y -= line_gap

    # Group background containers
    def draw_group(x, y, w, h, label, color):
        bg = patches.FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0.4,rounding_size=1.2",
            facecolor=color, edgecolor="#e2e8f0", linewidth=0.8, alpha=0.15, zorder=0
        )
        ax.add_patch(bg)
        ax.text(
            x + 1.2, y + h - 1.2, label.upper(),
            ha="left", va="top", color="#64748b",
            fontsize=7, fontweight="bold", zorder=1
        )

    # 1. GROUP: USUARIOS & ACCESO (Top Left)
    draw_group(2, 73, 28, 25, "1. Usuarios y Seguridad", "#e0e7ff")
    draw_entity(3, 74.5, 12.5, 19, "usuarios", [
        "[PK] id : INT",
        "     nombre : VARCHAR",
        "     correo : VARCHAR (UK)",
        "     turno : VARCHAR",
        "     password : VARCHAR",
        "     is_verified : BOOL",
        "     ultima_conexion : DT"
    ], c_user)

    draw_entity(16.5, 74.5, 12.5, 19, "usuarios_pendientes", [
        "[PK] id : INT",
        "     nombre : VARCHAR",
        "     correo : VARCHAR (UK)",
        "     turno : VARCHAR",
        "     password : VARCHAR",
        "     verification_code",
        "     expira : DATETIME"
    ], c_user)

    # 2. GROUP: DOCENTES & SUPLENCIAS (Middle Left)
    draw_group(2, 40, 28, 31, "2. Docentes y Suplencias", "#ccfbf1")
    draw_entity(3, 54, 12.5, 14, "docentes", [
        "[PK] id : INT",
        "     nombre : VARCHAR",
        "     especialidad : VARCHAR",
        "     materias : JSON",
        "     correo : VARCHAR"
    ], c_doc)

    draw_entity(16.5, 54, 12.5, 14, "suplencias", [
        "[PK] id : INT",
        "[FK] docente_id : INT",
        "[FK] suplente_id : INT",
        "     materia : VARCHAR",
        "     fecha : DATE",
        "     hora_inicio, fin",
        "     activa : BOOLEAN"
    ], c_doc)

    draw_entity(3, 41.5, 26, 10, "suplencias_horarios", [
        "[PK] id : INT",
        "     docente_nombre : VARCHAR | suplente_nombre : VARCHAR",
        "     materia : VARCHAR | fecha : DATE | horas : TIME | activa : BOOL"
    ], c_doc)

    # 3. GROUP: AULAS E INFRAESTRUCTURA (Bottom Left)
    draw_group(2, 3, 28, 35, "3. Aulas e Infraestructura", "#ede9fe")
    draw_entity(3, 17, 26, 18, "aulas", [
        "[PK] id : INT",
        "     nombre : VARCHAR (UK)",
        "     edificio : VARCHAR",
        "     capacidad : INT",
        "     equipos : JSON",
        "     en_mantenimiento : BOOLEAN",
        "     inicio_mantenimiento, fin_mantenimiento",
        "     aula_temporal : VARCHAR"
    ], c_aula)

    draw_entity(3, 4.5, 26, 10.5, "aulas_liberadas", [
        "[PK] id : INT",
        "[FK] aula_nombre : VARCHAR",
        "     fecha : DATE | horario : VARCHAR",
        "     docente : VARCHAR | motivo : VARCHAR | activa : BOOL"
    ], c_aula)

    # 4. GROUP: HORARIOS & CLASES (Center Column)
    draw_group(32, 28, 34, 70, "4. Horarios y Registro de Clases", "#dbeafe")
    draw_entity(33.5, 74, 31, 21, "horarios", [
        "[PK] id : INT",
        "[FK] docente : VARCHAR (Docente)",
        "[FK] aula_asignada : VARCHAR (Aula)",
        "     asignatura : VARCHAR",
        "     horario : VARCHAR (Días y Rango Horario)",
        "     carrera : VARCHAR | semestre : VARCHAR | grupo : VARCHAR",
        "     archivo : VARCHAR | estado_slug : VARCHAR",
        "     fecha_reposicion : DATE | es_reposicion : BOOL"
    ], c_hor)

    draw_entity(33.5, 52, 31, 19, "clases_historico", [
        "[PK] id : INT",
        "[FK] clase_id : INT",
        "     fecha : DATE | dia_semana : VARCHAR",
        "     docente_nombre : VARCHAR | asignatura_nombre",
        "     horario_inicio, horario_fin : TIME",
        "     aula_original, aula_actual : VARCHAR",
        "     estado_slug : VARCHAR | incidencia_detalle : TEXT"
    ], c_hor)

    draw_entity(33.5, 30, 15, 19, "historial_periodos", [
        "[PK] id : INT",
        "     nombre_ciclo : VARCHAR",
        "     tipo_periodo : VARCHAR",
        "     materia : VARCHAR",
        "     docente : VARCHAR",
        "     aula_asignada : VARCHAR",
        "     carrera, semestre, grupo"
    ], c_hor)

    draw_entity(49.5, 30, 15, 19, "historial_reprogram.", [
        "[PK] id : INT",
        "     docente : VARCHAR",
        "     asignatura : VARCHAR",
        "     horario_reposicion",
        "     fecha_reposicion : DATE",
        "     aula_asignada : VARCHAR",
        "     nota_reprogramacion"
    ], c_hor)

    # 5. GROUP: EVENTOS & RESERVAS (Top Right)
    draw_group(68, 52, 30, 46, "5. Agenda y Reservas de Aulas", "#f3e8ff")
    draw_entity(69.5, 75, 27, 20.5, "eventos_aulas", [
        "[PK] id : INT",
        "[FK] aula_nombre : VARCHAR",
        "     tipo_evento : VARCHAR",
        "     nombre_evento : VARCHAR",
        "     fecha : DATE | hora_inicio, hora_fin : TIME",
        "     responsable : VARCHAR | correo : VARCHAR",
        "     estado : 'Programado'|'En curso'|'Finalizado'"
    ], c_ev)

    draw_entity(69.5, 54, 13, 18, "eventos_record.", [
        "[PK] id : INT",
        "[FK] evento_id : INT",
        "     tipo : VARCHAR",
        "     fecha_programada",
        "     estado : 'pendiente'",
        "     fecha_envio : DATETIME"
    ], c_ev)

    draw_entity(83.5, 54, 13, 18, "eventos_historial", [
        "[PK] id : INT",
        "[FK] evento_id : INT",
        "     usuario : VARCHAR",
        "     accion : VARCHAR",
        "     detalles : TEXT",
        "     fecha : DATETIME"
    ], c_ev)

    # 6. GROUP: CALENDARIOS & EXÁMENES (Bottom Center / Right)
    draw_group(32, 3, 34, 23, "6. Calendarios y Exámenes", "#fef3c7")
    draw_entity(33.5, 4.5, 15, 18.5, "calendario_instit.", [
        "[PK] id : INT",
        "     plan : VARCHAR",
        "     ciclo : VARCHAR",
        "     tipo_evento : VARCHAR",
        "     fecha_inicio, fecha_fin",
        "     suspende_clases : BOOL"
    ], c_cal)

    draw_entity(49.5, 4.5, 15, 18.5, "examenes_calendario", [
        "[PK] id : INT",
        "     carrera : VARCHAR",
        "     periodo : VARCHAR",
        "     semestre : VARCHAR",
        "     fecha : VARCHAR",
        "     materia : VARCHAR",
        "     ciclo_escolar : VARCHAR"
    ], c_cal)

    # 7. GROUP: AUDITORÍA & REPORTES (Bottom Right)
    draw_group(68, 3, 30, 47, "7. Auditoría y Trazabilidad", "#f1f5f9")
    draw_entity(69.5, 30, 27, 17.5, "bitacora_cambios", [
        "[PK] id : INT",
        "     usuario : VARCHAR",
        "     tipo_operacion : VARCHAR (CRUD)",
        "     modulo_afectado : VARCHAR",
        "     registro_id : INT",
        "     aula_anterior ➔ aula_nueva",
        "     motivo : TEXT | diff_json : TEXT"
    ], c_aud)

    draw_entity(69.5, 17, 27, 10.5, "auditoria_exportaciones", [
        "[PK] id : INT",
        "     usuario_nombre, correo | tipo_exportacion",
        "     filtros_aplicados | cantidad_registros"
    ], c_aud)

    draw_entity(69.5, 4.5, 27, 10, "reportes_compartidos", [
        "[PK] id : VARCHAR (UUID)",
        "     nombre_archivo : VARCHAR | tipo : VARCHAR",
        "     contenido : LONGBLOB | fecha_hora : DT"
    ], c_aud)

    # RELATIONSHIP CONNECTORS (Arrows & Paths)
    def draw_relation(x1, y1, x2, y2, label="", color="#475569", style="-|>", rad=0.0):
        connectionstyle = f"arc3,rad={rad}" if rad != 0.0 else "arc3"
        ax.annotate(
            "", xy=(x2, y2), xytext=(x1, y1),
            arrowprops=dict(
                arrowstyle=style, color=color, lw=1.5,
                shrinkA=3, shrinkB=3,
                connectionstyle=connectionstyle
            ),
            zorder=5
        )
        if label:
            mx = (x1 + x2) / 2 + (0.5 if rad != 0 else 0)
            my = (y1 + y2) / 2 + (0.5 if rad != 0 else 0)
            ax.text(
                mx, my, label,
                ha="center", va="center", color=color,
                fontsize=6, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.2", facecolor="#ffffff", edgecolor=color, lw=0.6),
                zorder=6
            )

    # Relation 1: usuarios_pendientes -> usuarios (OTP verify)
    draw_relation(16.5, 84, 15.5, 84, "OTP", "#1c355e", "-|>")

    # Relation 2: docentes -> suplencias (1:N)
    draw_relation(15.5, 61, 16.5, 61, "1 : N", "#0f766e", "-|>")

    # Relation 3: docentes -> horarios (1:N)
    draw_relation(15.5, 65, 33.5, 80, "titular", "#0f766e", "-|>", rad=0.15)

    # Relation 4: aulas -> horarios (1:N aula_asignada)
    draw_relation(29, 25, 33.5, 75, "aula física", "#4338ca", "-|>", rad=-0.2)

    # Relation 5: aulas -> aulas_liberadas (1:N)
    draw_relation(16, 17, 16, 15, "1 : N", "#4338ca", "-|>")

    # Relation 6: aulas -> eventos_aulas (1:N aula reservada)
    draw_relation(29, 20, 69.5, 78, "reserva salón", "#7e22ce", "-|>", rad=-0.12)

    # Relation 7: eventos_aulas -> recordatorios (1:N)
    draw_relation(76, 75, 76, 72, "1 : N", "#7e22ce", "-|>")

    # Relation 8: eventos_aulas -> historial (1:N)
    draw_relation(88, 75, 88, 72, "1 : N", "#7e22ce", "-|>")

    # Relation 9: horarios -> clases_historico (1:N)
    draw_relation(49, 74, 49, 71, "1 : N", "#1d4ed8", "-|>")

    # Relation 10: horarios -> historial_periodos (cierre de ciclo)
    draw_relation(41, 74, 41, 49, "archivo", "#1d4ed8", "-|>")

    # Relation 11: horarios -> historial_reprogramaciones
    draw_relation(57, 74, 57, 49, "reprogramada", "#1d4ed8", "-|>")

    # Header banner on top
    banner = patches.Rectangle((0, 98), 100, 2, facecolor="#1c355e", edgecolor="none", zorder=10)
    ax.add_patch(banner)
    ax.text(
        50, 99, "DIAGRAMA ENTIDAD-RELACIÓN (ER) — SISTEMA SIPREF — UNIVERSIDAD LATINO",
        ha="center", va="center", color="#ffffff",
        fontsize=9.5, fontweight="bold", zorder=11
    )

    plt.tight_layout()
    plt.savefig(output_png, bbox_inches="tight", dpi=300)
    plt.close()
    print(f"Diagrama ER generado exitosamente: {output_png}")

if __name__ == "__main__":
    out_path = os.path.abspath("diagrama_er_sistema.png")
    generar_diagrama_er(out_path)
