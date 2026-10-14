#!/usr/bin/env python3
"""Bust Pages HTML references to rapidly changing first-party assets.

GitHub Pages and browsers may cache jobs.js between successful deployments.
This changes only deployed build artifacts, never the committed source files.
"""
from datetime import datetime,timezone
from pathlib import Path
import re

SITE=Path(__file__).resolve().parents[1]/"site"
tag=datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
for filename in ("index.html","resume-studio.html"):
    path=SITE/filename
    html=path.read_text(encoding="utf-8")
    for asset in ("jobs.js","resume-studio.js","resume-studio.css"):
        # Strictly limit replacement to our relative first-party file references.
        rule=r'((?:src|href)="(?:\./)?'+re.escape(asset)+r')(?:\?v=[0-9]+)?(")'
        html=re.sub(rule,lambda match:match.group(1)+"?v="+tag+match.group(2),html)
    path.write_text(html,encoding="utf-8")
print("Updated browser-cache keys for published HTML: "+tag)
