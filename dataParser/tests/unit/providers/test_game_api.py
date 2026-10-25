import logging
import os
import stat
from pathlib import Path

import pytest

from providers.game_api import EXPORT_COMMAND, GameDataProvider


def write_fake_command(folder: Path, exit_code: int) -> None:
    """Writes a fake export command that creates exported.txt in its working folder."""
    if os.name == "nt":
        script = folder / f"{EXPORT_COMMAND}.cmd"
        script.write_text(f"@echo off\necho done> exported.txt\nexit /b {exit_code}\n")
    else:
        script = folder / EXPORT_COMMAND
        script.write_text(f"#!/bin/sh\necho done > exported.txt\nexit {exit_code}\n")
        script.chmod(script.stat().st_mode | stat.S_IEXEC)


def run_export(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    exit_code: int | None,
    vendor: Path,
) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    if exit_code is not None:
        write_fake_command(bin_dir, exit_code)
    monkeypatch.setenv("PATH", str(bin_dir))
    provider = GameDataProvider()
    provider.vendor_dir = str(vendor)
    provider.run_export()


def test_run_export_runs_the_command_in_the_vendor_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    vendor = tmp_path / "vendor"
    vendor.mkdir()

    run_export(tmp_path, monkeypatch, 0, vendor)

    assert (vendor / "exported.txt").is_file()
    assert f"Exported game data to: {vendor}" in caplog.text
    assert "failed" not in caplog.text


def test_run_export_logs_a_command_that_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    vendor = tmp_path / "vendor"
    vendor.mkdir()

    run_export(tmp_path, monkeypatch, 3, vendor)

    assert (vendor / "exported.txt").is_file()
    assert "Game data export failed:" in caplog.text
    assert "exit status 3" in caplog.text
    assert "Exported game data" not in caplog.text


def test_run_export_logs_a_command_missing_from_the_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    vendor = tmp_path / "vendor"
    vendor.mkdir()

    run_export(tmp_path, monkeypatch, None, vendor)

    assert (
        f"Game data export failed: {EXPORT_COMMAND} is not on the PATH" in caplog.text
    )
    assert not (vendor / "exported.txt").exists()


def test_run_export_logs_a_missing_vendor_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)

    run_export(tmp_path, monkeypatch, 0, tmp_path / "missing")

    assert "Game data export failed:" in caplog.text
    assert "Exported game data" not in caplog.text
