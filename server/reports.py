import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_daily_report_pdf(metrics: dict, recent_logs: list, ai_summary: str = None) -> bytes:
    """
    Generates a PDF SOC report and returns it as a bytes object.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#4f46e5"), # Indigo 600
        spaceAfter=14
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.gray,
        spaceAfter=20
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor("#1e293b"), # Slate 800
        spaceBefore=20,
        spaceAfter=10
    )
    
    body_style = styles['Normal']
    
    elements = []
    
    # 1. Header
    elements.append(Paragraph("Sentinel Face Secure", title_style))
    current_time = datetime.now().strftime("%B %d, %Y - %H:%M %Z")
    elements.append(Paragraph(f"Security Operations Center (SOC) Daily Report<br/>Generated: {current_time}", subtitle_style))
    elements.append(Spacer(1, 0.25*inch))
    
    # 2. Executive Summary (AI)
    elements.append(Paragraph("Executive Summary", section_style))
    if ai_summary:
        # reportlab Paragraph handles basic HTML like <br/> and <b>
        # Convert markdown newlines to <br/>
        clean_summary = ai_summary.replace('\n\n', '<br/><br/>').replace('\n', '<br/>')
        # Replace Markdown bold with HTML bold
        import re
        clean_summary = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', clean_summary)
        
        elements.append(Paragraph(clean_summary, body_style))
    else:
        elements.append(Paragraph("No AI summary available for this period.", body_style))
        
    elements.append(Spacer(1, 0.25*inch))
    
    # 3. High-Level Metrics
    elements.append(Paragraph("24-Hour Metrics", section_style))
    metrics_data = [
        ["Metric", "Count"],
        ["Total Authentication Events", str(metrics.get('total', 0))],
        ["Safe Logins", str(metrics.get('success', 0))],
        ["Suspicious Events", str(metrics.get('suspicious', 0))],
        ["High Risk / Spoofs", str(metrics.get('highRisk', 0))]
    ]
    
    metrics_table = Table(metrics_data, colWidths=[3*inch, 2*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 0.25*inch))
    
    # 4. Recent Threat Logs
    elements.append(Paragraph("Recent Threat Events (High/Medium Risk)", section_style))
    
    if recent_logs:
        log_data = [["Time", "IP Address", "Device", "Status", "Risk"]]
        for log in recent_logs:
            time_str = log.get('timestamp', '').strftime('%Y-%m-%d %H:%M') if hasattr(log.get('timestamp'), 'strftime') else str(log.get('timestamp', ''))
            ip = log.get('ipAddress', 'Unknown')
            device = str(log.get('device') or log.get('os') or 'Unknown')[:20]
            status = log.get('status', 'Unknown')
            risk = f"{log.get('riskScore', 0)} ({log.get('riskLevel', 'N/A')})"
            
            log_data.append([time_str, ip, device, status, risk])
            
        log_table = Table(log_data, colWidths=[1.25*inch, 1.25*inch, 1.25*inch, 1.25*inch, 1.25*inch])
        log_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ]))
        elements.append(log_table)
    else:
        elements.append(Paragraph("No significant threat events recorded in this period.", body_style))
        
    # Build PDF
    doc.build(elements)
    
    # Get the value from the BytesIO buffer
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
