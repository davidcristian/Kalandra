import json
import unittest
from collections.abc import Mapping

from support import broken_repo, repo, run

import allowscripts
from allowscripts import Entry, parse_key


def package(allow: object) -> str:
    return json.dumps({"name": "app", "allowScripts": allow}, indent=2)


def lock(packages: dict[str, dict[str, object]]) -> str:
    return json.dumps({"name": "app", "lockfileVersion": 3, "packages": {"": {"name": "app"}, **packages}}, indent=2)


def scripted(version: str, **fields: object) -> dict[str, object]:
    return {"version": version, "hasInstallScript": True, **fields}


MAIN_LOCK = lock(
    {
        "node_modules/electron": scripted("40.10.6"),
        "node_modules/@scope/native": scripted("1.0.0-beta.2"),
        "node_modules/a/node_modules/esbuild": scripted("0.21.5"),
        "node_modules/esbuild": scripted("0.28.0"),
        "node_modules/aliased": scripted("2.0.0", name="real-name"),
        "node_modules/from-git": {"hasInstallScript": True},
        "node_modules/plain": {"version": "1.0.0"},
    }
)


def check(files: Mapping[str, str | bytes]) -> tuple[int, str]:
    with repo(files) as root:
        return run(allowscripts.main, root)


class ParseKeyTest(unittest.TestCase):
    def test_reads_the_name_and_an_exact_version(self) -> None:
        self.assertEqual(parse_key("electron@40.10.2"), Entry("electron@40.10.2", "electron", "40.10.2"))
        self.assertEqual(
            parse_key("@scope/native@1.0.0-beta.2"),
            Entry("@scope/native@1.0.0-beta.2", "@scope/native", "1.0.0-beta.2"),
        )

    def test_matches_the_name_alone_for_no_version_or_a_range(self) -> None:
        self.assertEqual(parse_key("electron"), Entry("electron", "electron", None))
        self.assertEqual(parse_key("@scope/native"), Entry("@scope/native", "@scope/native", None))
        self.assertEqual(parse_key("electron@^40.0.0"), Entry("electron@^40.0.0", "electron", None))
        self.assertEqual(parse_key("vue-demi@0.14 || 0.15"), Entry("vue-demi@0.14 || 0.15", "vue-demi", None))


class AllowScriptsTest(unittest.TestCase):
    def test_passes_entries_that_match_a_locked_package_with_an_install_script(self) -> None:
        allow = {
            "electron@40.10.6": True,
            "@scope/native@1.0.0-beta.2": True,
            "esbuild@0.21.5": True,
            "esbuild@0.28.0": False,
            "real-name@2.0.0": True,
            "aliased@2.0.0": True,
            "from-git": True,
            "electron@^40.0.0": True,
        }
        files = {
            "main/package.json": package(allow),
            "main/package-lock.json": MAIN_LOCK,
            "docs/package.json": json.dumps({"name": "docs"}),
            "docs/package-lock.json": lock({}),
            "tool/package.json": package({"gone@1.0.0": True}),
        }
        code, output = check(files)
        self.assertEqual(code, 0, output)
        self.assertEqual(output, "allowscripts OK: 8 allowScripts entries match their lock files\n")

    def test_reports_an_entry_whose_package_moved_to_another_version(self) -> None:
        files = {"main/package.json": package({"electron@40.10.2": True}), "main/package-lock.json": MAIN_LOCK}
        code, output = check(files)
        self.assertEqual(code, 1)
        self.assertEqual(
            output.splitlines(),
            [
                (
                    "main/package.json: allowScripts names electron@40.10.2, but package-lock.json has electron"
                    " 40.10.6: review that version's install script, then run npm install-scripts approve electron"
                    " in main/"
                )
            ],
        )

    def test_reports_an_entry_whose_package_is_gone_or_has_no_install_script(self) -> None:
        allow = {"plain@1.0.0": True, "removed": False}
        files = {"renderer/package.json": package(allow), "renderer/package-lock.json": MAIN_LOCK}
        code, output = check(files)
        self.assertEqual(code, 1)
        prune = "with an install script: run npm install-scripts prune in renderer/"
        self.assertEqual(
            output.splitlines(),
            [
                f"renderer/package.json: allowScripts names plain@1.0.0, but package-lock.json has no plain {prune}",
                f"renderer/package.json: allowScripts names removed, but package-lock.json has no removed {prune}",
            ],
        )

    def test_reports_every_entry_when_the_lock_lists_no_packages(self) -> None:
        files = {"main/package.json": package({"electron": True}), "main/package-lock.json": json.dumps({})}
        code, output = check(files)
        self.assertEqual(code, 1)
        self.assertIn("allowScripts names electron, but package-lock.json has no electron", output)

    def test_exits_2_when_no_package_json_with_a_lock_file_has_an_entry(self) -> None:
        files = {"main/package.json": json.dumps({"name": "app"}), "main/package-lock.json": MAIN_LOCK}
        code, output = check(files)
        self.assertEqual(code, 2)
        self.assertIn("allowscripts: no allowScripts entry under", output)

    def test_exits_2_when_a_file_does_not_parse_or_has_the_wrong_shape(self) -> None:
        cases = {
            "cannot read main/package-lock.json": (package({"electron": True}), "{"),
            "main/package-lock.json is not a JSON object": (package({"electron": True}), "[]"),
            "main/package.json: allowScripts is not an object": (package(["electron"]), MAIN_LOCK),
        }
        for message, (package_json, lock_json) in cases.items():
            with self.subTest(message):
                code, output = check({"main/package.json": package_json, "main/package-lock.json": lock_json})
                self.assertEqual(code, 2)
                self.assertTrue(output.startswith(f"allowscripts: {message}"), output)

    def test_exits_2_when_git_cannot_list_the_files(self) -> None:
        with broken_repo() as root:
            code, output = run(allowscripts.main, root)
        self.assertEqual(code, 2)
        self.assertTrue(output.startswith("allowscripts: git ls-files failed in "), output)
