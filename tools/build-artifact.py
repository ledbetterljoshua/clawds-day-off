#!/usr/bin/env python3
"""Prepare dist/artifact/ for publishing as a claude.ai Artifact: the host wraps the page in its
own document skeleton, so index.html loses its doctype/html/head/body tags; src/ ships as-is.
Prints the JSON `files` map for the Artifact tool."""
import json, os, re, shutil

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'dist', 'artifact')
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(os.path.join(root, 'src'), os.path.join(out, 'src'))

html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*',
            r'<body>\s*', r'</body>\s*', r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*']:
    html = re.sub(pat, '', html, flags=re.I)
title = re.search(r'<title>.*?</title>\s*', html).group(0)
html = title + html.replace(title, '', 1)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)

files = {}
for dp, _, fs in os.walk(os.path.join(out, 'src')):
    for f in fs:
        if f.endswith('.js'):
            full = os.path.join(dp, f)
            files[os.path.relpath(full, out)] = full
print(json.dumps(files, indent=1))
print(f'{len(files)} files', file=__import__('sys').stderr)
