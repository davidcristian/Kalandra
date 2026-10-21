import json
import subprocess
import sys
import unittest
from collections.abc import Sequence
from pathlib import Path

from support import repo, run

import versioncheck

VERSION = "0.16.3"
OTHER = "0.17.0"
SCRIPT = Path(versioncheck.__file__).resolve()
LABELS = (
    "README.md version",
    "Bug report version",
    "Config.js version",
    "package.json version",
    "package-lock.json top-level version",
    "package-lock.json packages[] version",
)


def readme(version: str) -> str:
    badge = f"https://img.shields.io/github/downloads/davidcristian/Kalandra/latest/Kalandra-Setup-{version}.exe"
    return f"# Kalandra\n\n[![GitHub Downloads]({badge}?style=plastic)](https://example.com)\n"


def bug_report(version: str) -> str:
    return (
        "body:\n"
        "  - type: checkboxes\n"
        "    attributes:\n"
        "      options:\n"
        "        - label: I have checked the FAQ\n"
        "  - type: dropdown\n"
        "    attributes:\n"
        "      label: Version\n"
        "      options:\n"
        f"        - {version}\n"
        "        - 0.15.1\n"
    )


def docs_config(version: str) -> str:
    return f"export default {{\n  themeConfig: {{\n    appVersion: '{version}',\n  }}\n}}\n"


def package_lock(top: str, packages: str) -> str:
    lock = {"name": "kalandra", "version": top, "lockfileVersion": 3, "packages": {"": {"version": packages}}}
    return json.dumps(lock, indent=2)


def version_files(version: str = VERSION) -> dict[str, str | bytes]:
    return {
        versioncheck.README: readme(version),
        versioncheck.BUG_REPORT: bug_report(version),
        versioncheck.DOCS_CONFIG: docs_config(version),
        versioncheck.PACKAGE_JSON: json.dumps({"name": "kalandra", "version": version}, indent=2),
        versioncheck.PACKAGE_LOCK: package_lock(version, version),
    }


def mismatch(label: str, version: str | None) -> list[str]:
    lines = [f"  {name}: {version if name == label else VERSION}" for name in LABELS]
    return ["Version mismatch detected:", *lines]


def check(files: dict[str, str | bytes], extra: Sequence[str] = ()) -> tuple[int, str]:
    with repo(files) as root:
        return run(lambda argv: versioncheck.main([*argv, *extra]), root)


class VersionCheckTest(unittest.TestCase):
    def test_passes_when_the_five_files_name_the_same_version(self) -> None:
        code, output = check(version_files())
        self.assertEqual(code, 0, output)
        self.assertEqual(output, "Version check passed. All versions are consistent.\n")

    def test_ignores_the_changed_files_that_pre_commit_passes(self) -> None:
        code, output = check(version_files(), ["README.md", "docs/index.md"])
        self.assertEqual(code, 0, output)

    def test_reports_each_version_when_one_place_differs(self) -> None:
        changes: dict[str, dict[str, str | bytes]] = {
            LABELS[0]: {versioncheck.README: readme(OTHER)},
            LABELS[1]: {versioncheck.BUG_REPORT: bug_report(OTHER)},
            LABELS[2]: {versioncheck.DOCS_CONFIG: docs_config(OTHER)},
            LABELS[3]: {versioncheck.PACKAGE_JSON: json.dumps({"version": OTHER})},
            LABELS[4]: {versioncheck.PACKAGE_LOCK: package_lock(OTHER, VERSION)},
            LABELS[5]: {versioncheck.PACKAGE_LOCK: package_lock(VERSION, OTHER)},
        }
        for label, change in changes.items():
            with self.subTest(label):
                code, output = check(version_files() | change)
                self.assertEqual(code, 1, output)
                self.assertEqual(output.splitlines(), mismatch(label, OTHER))

    def test_a_text_file_without_a_version_is_a_mismatch(self) -> None:
        names = (versioncheck.README, versioncheck.BUG_REPORT, versioncheck.DOCS_CONFIG)
        for label, name in zip(LABELS[:3], names, strict=True):
            with self.subTest(name):
                code, output = check(version_files() | {name: "options:\n  - Other\n"})
                self.assertEqual(code, 1, output)
                self.assertEqual(output.splitlines(), mismatch(label, None))

    def test_a_missing_file_fails_with_its_name(self) -> None:
        for name in version_files():
            with self.subTest(name):
                files = version_files()
                del files[name]
                code, output = check(files)
                self.assertEqual(code, 2, output)
                self.assertIn(f"versioncheck: cannot read {name}: ", output)

    def test_a_folder_in_place_of_a_file_fails_with_its_name(self) -> None:
        with repo(version_files()) as root:
            (root / versioncheck.README).unlink()
            (root / versioncheck.README).mkdir()
            code, output = run(versioncheck.main, root)
        self.assertEqual(code, 2, output)
        self.assertIn("versioncheck: cannot read README.md: ", output)

    def test_an_unreadable_or_malformed_file_fails_with_the_reason(self) -> None:
        cases: dict[str, tuple[str, str | bytes]] = {
            "cannot read docs/.vitepress/config.js: ": (versioncheck.DOCS_CONFIG, b"appVersion: '\xff'"),
            "cannot parse main/package.json: ": (versioncheck.PACKAGE_JSON, '{"version": '),
            "main/package.json has no version string at ['version']": (
                versioncheck.PACKAGE_JSON,
                '{"version": 16}',
            ),
            "main/package-lock.json has no version string at ['packages']['']['version']": (
                versioncheck.PACKAGE_LOCK,
                json.dumps({"version": VERSION, "packages": []}),
            ),
        }
        for message, (name, content) in cases.items():
            with self.subTest(message):
                code, output = check(version_files() | {name: content})
                self.assertEqual(code, 2, output)
                self.assertIn(f"versioncheck: {message}", output)

    def test_runs_from_the_repo_root_as_the_hook_calls_it(self) -> None:
        for change, code, text in (
            ({}, 0, "Version check passed."),
            ({versioncheck.README: readme(OTHER)}, 1, f"README.md version: {OTHER}"),
        ):
            with self.subTest(code=code), repo(version_files() | change) as root:
                result = subprocess.run(  # noqa: S603 the current Python running this repo's script
                    [sys.executable, str(SCRIPT), "README.md", "main/package.json"],
                    cwd=root,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, code, result.stdout + result.stderr)
                self.assertIn(text, result.stdout)
