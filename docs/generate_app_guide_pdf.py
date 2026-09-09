from html import escape
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "APP_GUIDE.md"
OUTPUT = ROOT / "docs" / "APP_GUIDE.pdf"


def inline_markup(value: str) -> str:
    value = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    value = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", value)
    return value


def clean_text(value: str) -> str:
    replacements = {"\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2192": "->"}
    for old, new in replacements.items():
        value = value.replace(old, new)
    return value


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("GuideTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=27, alignment=TA_CENTER, textColor=colors.HexColor("#166534"), spaceAfter=12))
    styles.add(ParagraphStyle("GuideH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=colors.HexColor("#166534"), spaceBefore=13, spaceAfter=7, keepWithNext=True))
    styles.add(ParagraphStyle("GuideH2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=colors.HexColor("#14532d"), spaceBefore=9, spaceAfter=4, keepWithNext=True))
    styles.add(ParagraphStyle("GuideBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=13, spaceAfter=5))
    styles.add(ParagraphStyle("GuideBullet", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.5, leftIndent=13, firstLineIndent=-8, spaceAfter=2))
    styles.add(ParagraphStyle("GuideCode", parent=styles["Code"], fontName="Courier", fontSize=7.2, leading=9, leftIndent=7, rightIndent=7, borderColor=colors.HexColor("#d1d5db"), borderWidth=0.5, borderPadding=5, backColor=colors.HexColor("#f3f4f6"), spaceBefore=3, spaceAfter=7))
    styles.add(ParagraphStyle("GuideSmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.5, leading=9.5, spaceAfter=0))
    return styles


def parse_markdown(styles):
    lines = [clean_text(line.rstrip("\n")) for line in SOURCE.read_text(encoding="utf-8").splitlines()]
    story = []
    index = 0
    first_heading = True

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        if line.startswith("```"):
            code_lines = []
            index += 1
            while index < len(lines) and not lines[index].startswith("```"):
                code_lines.append(lines[index])
                index += 1
            story.append(XPreformatted(escape("\n".join(code_lines)), styles["GuideCode"]))
            index += 1
            continue

        heading = re.match(r"^(#{1,3})\s+(.*)$", line)
        if heading:
            level, text = len(heading.group(1)), inline_markup(heading.group(2))
            if first_heading:
                story.append(Paragraph(text, styles["GuideTitle"]))
                story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#86efac"), spaceAfter=10))
                first_heading = False
            elif level == 2:
                story.append(Paragraph(text, styles["GuideH1"]))
            else:
                story.append(Paragraph(text, styles["GuideH2"]))
            index += 1
            continue

        if line.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].startswith("|"):
                table_lines.append(lines[index])
                index += 1
            rows = []
            for table_line in table_lines:
                cells = [cell.strip() for cell in table_line.strip().strip("|").split("|")]
                if cells and all(re.fullmatch(r"[-: ]+", cell) for cell in cells):
                    continue
                rows.append([Paragraph(inline_markup(cell), styles["GuideSmall"]) for cell in cells])
            if rows:
                widths = [max(35 * mm, 0) for _ in rows[0]]
                table = Table(rows, repeatRows=1, hAlign="LEFT")
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dcfce7")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#14532d")),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.append(KeepTogether(table))
                story.append(Spacer(1, 5))
            continue

        bullet = re.match(r"^\s*[-*]\s+(.*)$", line)
        numbered = re.match(r"^\s*\d+\.\s+(.*)$", line)
        if bullet or numbered:
            marker = "-" if bullet else numbered.group(0).split(".")[0] + "."
            text = bullet.group(1) if bullet else numbered.group(1)
            story.append(Paragraph(f"{marker} {inline_markup(text)}", styles["GuideBullet"]))
            index += 1
            continue

        paragraph_lines = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(r"^(#{1,3})\s+|^```|^\s*[-*]\s+|^\s*\d+\.\s+|^\|", lines[index]):
            paragraph_lines.append(lines[index])
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph_lines)), styles["GuideBody"]))

    return story


def add_page_number(canvas, document):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(18 * mm, 11 * mm, "Smart Exam System - Maintainer and Supervisor Guide")
    canvas.drawRightString(192 * mm, 11 * mm, f"Page {document.page}")
    canvas.restoreState()


def main():
    styles = make_styles()
    frame = Frame(18 * mm, 17 * mm, 174 * mm, 263 * mm, id="normal")
    document = BaseDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=19 * mm, title="Smart Exam System Maintainer and Supervisor Guide",
        author="Smart Exam System",
    )
    document.addPageTemplates([PageTemplate(id="guide", frames=[frame], onPage=add_page_number)])
    document.build(parse_markdown(styles))
    print(f"created {OUTPUT}")


if __name__ == "__main__":
    main()
