#!/usr/bin/env python3
"""Kept for the desk and the scripts that call it: the build now lives in tools/build.py."""
import runpy, pathlib
runpy.run_path(str(pathlib.Path(__file__).resolve().parent / "tools" / "build.py"), run_name="__main__")
