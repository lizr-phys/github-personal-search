from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterator, Union

from docx import Document
from docx.document import Document as DocumentType
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


Block = Union[Paragraph, Table]


def iter_blocks(document: DocumentType) -> Iterator[Block]:
    for child in document.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


def clean(text: str) -> str:
    return " ".join(text.replace("\u00a0", " ").split())


def escape_cell(text: str) -> str:
    return clean(text).replace("|", "\\|")


def extract(source: Path) -> tuple[str, dict[str, int]]:
    document = Document(source)
    output: list[str] = ["# GitHub Personal Search（GPS）PRD v1.0 — 提取文本", ""]
    paragraph_count = 0
    table_count = 0
    table_row_count = 0

    for block in iter_blocks(document):
        if isinstance(block, Paragraph):
            text = clean(block.text)
            if not text:
                continue
            paragraph_count += 1
            style_name = block.style.name if block.style is not None else ""
            if style_name.startswith("Heading"):
                try:
                    level = max(1, min(6, int(style_name.split()[-1])))
                except ValueError:
                    level = 2
                output.extend([f"{'#' * level} {text}", ""])
            elif style_name.lower().startswith("list"):
                output.append(f"- {text}")
            else:
                output.extend([text, ""])
            continue

        table_count += 1
        rows = [[escape_cell(cell.text) for cell in row.cells] for row in block.rows]
        if not rows:
            continue
        table_row_count += len(rows)
        width = max(len(row) for row in rows)
        normalized = [row + [""] * (width - len(row)) for row in rows]
        output.append("| " + " | ".join(normalized[0]) + " |")
        output.append("| " + " | ".join(["---"] * width) + " |")
        for row in normalized[1:]:
            output.append("| " + " | ".join(row) + " |")
        output.append("")

    text = "\n".join(output).rstrip() + "\n"
    stats = {
        "paragraphs": paragraph_count,
        "tables": table_count,
        "table_rows": table_row_count,
        "characters": len(text),
        "sections": len(document.sections),
    }
    return text, stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    text, stats = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    print(stats)


if __name__ == "__main__":
    main()
