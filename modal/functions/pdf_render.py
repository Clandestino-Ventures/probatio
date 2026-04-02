"""
SPECTRA — PDF Rendering
========================
Modal function that renders HTML into PDF using Puppeteer (via pyppeteer)
running headless Chromium inside a Modal container.

Used for generating screening reports and forensic evidence packages.

Runs on CPU — no GPU required.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import tempfile
import time
from typing import Any

import modal

from ..config import (
    PDF_RENDER_TIMEOUT,
    app,
    pdf_render_image,
)

logger = logging.getLogger("spectra.pdf_render")


async def _render_html_to_pdf(
    html_content: str,
    page_format: str = "A4",
    landscape: bool = False,
    print_background: bool = True,
    margin_top: str = "20mm",
    margin_bottom: str = "20mm",
    margin_left: str = "15mm",
    margin_right: str = "15mm",
    header_template: str = "",
    footer_template: str = "",
    display_header_footer: bool = False,
) -> bytes:
    """
    Render HTML string to PDF bytes using pyppeteer (headless Chromium).
    """
    from pyppeteer import launch

    browser = await launch(
        headless=True,
        handleSIGINT=False,
        handleSIGTERM=False,
        handleSIGHUP=False,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--font-render-hinting=none",
        ],
    )

    try:
        page = await browser.newPage()

        # Set content and wait for fonts / images to load
        await page.setContent(html_content, {"waitUntil": ["networkidle0", "load"]})

        # Allow any custom JS rendering to settle
        await page.evaluate("() => new Promise(r => setTimeout(r, 500))")

        pdf_options = {
            "format": page_format,
            "landscape": landscape,
            "printBackground": print_background,
            "margin": {
                "top": margin_top,
                "bottom": margin_bottom,
                "left": margin_left,
                "right": margin_right,
            },
        }

        if display_header_footer:
            pdf_options["displayHeaderFooter"] = True
            pdf_options["headerTemplate"] = header_template
            pdf_options["footerTemplate"] = footer_template

        pdf_bytes = await page.pdf(pdf_options)
        return pdf_bytes

    finally:
        await browser.close()


@app.function(
    image=pdf_render_image,
    timeout=PDF_RENDER_TIMEOUT,
    retries=1,
    memory=2048,
)
def pdf_render(
    html_content: str,
    page_format: str = "A4",
    landscape: bool = False,
    print_background: bool = True,
    margin_top: str = "20mm",
    margin_bottom: str = "20mm",
    margin_left: str = "15mm",
    margin_right: str = "15mm",
    header_template: str = "",
    footer_template: str = "",
    display_header_footer: bool = False,
) -> dict[str, Any]:
    """
    Render an HTML string into a PDF document.

    Parameters
    ----------
    html_content : str
        Complete HTML document to render.
    page_format : str
        Page size — "A4", "Letter", etc.
    landscape : bool
        Landscape orientation if True.
    print_background : bool
        Include CSS backgrounds.
    margin_* : str
        Page margins (CSS units).
    header_template / footer_template : str
        Chromium header/footer HTML templates.
    display_header_footer : bool
        Whether to show header/footer.

    Returns
    -------
    dict with keys:
        pdf_bytes : bytes        — raw PDF content
        pdf_base64 : str         — base64-encoded PDF (for JSON transport)
        size_bytes : int
        processing_time_ms : float
    """
    t0 = time.perf_counter()

    try:
        if not html_content or not html_content.strip():
            raise ValueError("html_content must be a non-empty string")

        logger.info("Rendering PDF (%s, landscape=%s)", page_format, landscape)

        pdf_bytes = asyncio.get_event_loop().run_until_complete(
            _render_html_to_pdf(
                html_content=html_content,
                page_format=page_format,
                landscape=landscape,
                print_background=print_background,
                margin_top=margin_top,
                margin_bottom=margin_bottom,
                margin_left=margin_left,
                margin_right=margin_right,
                header_template=header_template,
                footer_template=footer_template,
                display_header_footer=display_header_footer,
            )
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "PDF rendered in %.1f ms — %d bytes",
            elapsed_ms,
            len(pdf_bytes),
        )

        return {
            "pdf_bytes": pdf_bytes,
            "pdf_base64": base64.b64encode(pdf_bytes).decode("ascii"),
            "size_bytes": len(pdf_bytes),
            "processing_time_ms": round(elapsed_ms, 2),
        }

    except Exception:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.exception("PDF rendering failed after %.1f ms", elapsed_ms)
        raise
