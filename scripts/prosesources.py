"""Finds the prose in a file: markdown outside code, comments, docstrings, and the text of log and error messages."""

import ast
import io
import re
import tokenize
import warnings
from collections.abc import Callable
from pathlib import PurePosixPath

Line = tuple[int, str]

SCRIPT_SUFFIXES = frozenset({".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsonc"})
HASH_SUFFIXES = frozenset({".yml", ".yaml", ".toml", ".sh", ".txt", ".conf", ".dockerignore"})
HASH_NAMES = frozenset({"Dockerfile"})
LOG_METHODS = frozenset({"debug", "info", "warning", "error", "exception", "critical"})
# A call whose name ends with one of these builds a message, such as Problem(path, "...") or ValueError("...")
MESSAGE_CALLS = ("Problem", "Error", "Exception")
MESSAGE_KEYWORDS = frozenset({"help", "description", "epilog"})
# A "/" after one of these starts a regular expression; after anything else it divides
REGEX_AFTER = frozenset("(,=:[!&|?{};+-*%<>~^")

_FENCE = re.compile(r"^\s*(```|~~~)")
_SCRIPT_CALL = re.compile(
    r"(?:\blogger\.write|\bconsole\.(?:log|info|warn|error|debug)|\bdialog\.showErrorBox"
    r"|\bnew\s+\w*Error|\bthrow\s+new\s+\w+)\s*$"
)
_VUE_BLOCK = re.compile(r"<(script|style)\b[^>]*>(.*?)</\1>", re.DOTALL)
_HTML_COMMENT = re.compile(r"<!--(.*?)-->", re.DOTALL)
_CSS_COMMENT = re.compile(r"/\*(.*?)\*/", re.DOTALL)


class SourceError(Exception):
    """A Python file cannot be parsed."""


def prose_lines(name: str, text: str) -> list[Line]:
    """Returns the prose of a file as numbered lines, read according to its file type."""
    path = PurePosixPath(name)
    if path.name in HASH_NAMES or (path.name.startswith(".") and not path.suffix):
        return hash_prose(text)
    read = _READERS.get(path.suffix)
    return read(text) if read else []


def hash_prose(text: str) -> list[Line]:
    """Returns the text after the `#` of each line that starts with one."""
    return [(n, line.strip()[1:]) for n, line in enumerate(text.splitlines(), 1) if line.lstrip().startswith("#")]


def markdown_prose(text: str) -> list[Line]:
    """Returns every line outside a fenced code block."""
    lines: list[Line] = []
    fence: str | None = None
    for number, line in enumerate(text.splitlines(), start=1):
        found = _FENCE.match(line)
        if found is None:
            if fence is None:
                lines.append((number, line))
        elif fence is None:
            fence = found.group(1)
        elif found.group(1) == fence:
            fence = None
    return lines


def _split(text: str, first: int) -> list[Line]:
    return [(first + offset, part) for offset, part in enumerate(text.split("\n"))]


def _string_end(text: str, start: int) -> tuple[int, str]:
    """Returns the index after the string literal at ``start`` and its text, without template expressions."""
    quote, index, depth = text[start], start + 1, 0
    body: list[str] = []
    while index < len(text):
        char = text[index]
        if depth:
            depth += {"{": 1, "}": -1}.get(char, 0)
            body.append("\n" if char == "\n" else "")
        elif char == "\\":
            body.append(text[index : index + 2])
            index += 1
        elif char == quote:
            return index + 1, "".join(body)
        elif char == "\n" and quote != "`":
            return index, "".join(body)
        elif quote == "`" and text.startswith("${", index):
            depth, index = 1, index + 1
        else:
            body.append(char)
        index += 1
    return index, "".join(body)


def _regex_end(text: str, start: int) -> int:
    index, in_class = start + 1, False
    while index < len(text) and text[index] != "\n":
        char = text[index]
        if char == "\\":
            index += 1
        elif char == "[":
            in_class = True
        elif char == "]":
            in_class = False
        elif char == "/" and not in_class:
            return index + 1
        index += 1
    return index


def script_prose(text: str, first_line: int = 1) -> list[Line]:
    """Returns the comments of TypeScript or JavaScript, and the strings passed to a log or error call."""
    found: list[Line] = []
    calls: list[bool] = []
    index, line, last = 0, first_line, ""
    while index < len(text):
        char, pair = text[index], text[index : index + 2]
        if pair in {"//", "/*"}:
            end = text.find("\n" if pair == "//" else "*/", index + 2)
            end = len(text) if end < 0 else end
            found.extend(_split(text[index + 2 : end], line))
            line += text.count("\n", index, end)
            index = end if pair == "//" else end + 2
            continue
        if char in "'\"`":
            end, body = _string_end(text, index)
            if any(calls):
                found.extend(_split(body, line))
            line += text.count("\n", index, end)
            index, last = end, "a"
            continue
        if char == "/" and (last in REGEX_AFTER or not last):
            index, last = _regex_end(text, index), "a"
            continue
        if char == "(":
            calls.append(_SCRIPT_CALL.search(text, max(0, index - 80), index) is not None)
        elif char == ")" and calls:
            calls.pop()
        if char == "\n":
            line += 1
        elif not char.isspace():
            last = char
        index += 1
    return found


def _comments(pattern: re.Pattern[str], text: str) -> list[Line]:
    """Returns the text of each match of ``pattern``'s first group, with its line numbers."""
    found: list[Line] = []
    for comment in pattern.finditer(text):
        found.extend(_split(comment.group(1), text.count("\n", 0, comment.start(1)) + 1))
    return found


def css_prose(text: str) -> list[Line]:
    """Returns the comments of a CSS file."""
    return _comments(_CSS_COMMENT, text)


def vue_prose(text: str) -> list[Line]:
    """Returns the prose of the script and style blocks of a Vue or HTML file, and the HTML comments outside them."""
    found: list[Line] = []
    for block in _VUE_BLOCK.finditer(text):
        found.extend(script_prose(block.group(2), text.count("\n", 0, block.start(2)) + 1))
    template = _VUE_BLOCK.sub(lambda block: "\n" * block.group().count("\n"), text)
    found.extend(_comments(_HTML_COMMENT, template))
    return sorted(found)


def _parts(node: ast.AST) -> list[ast.expr]:
    """Returns the parts of a message: of an f-string, `+`, `%`, `x if c else y`, or a comprehension."""
    if isinstance(node, ast.JoinedStr):
        return list(node.values)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return [node.left, node.right]
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
        return [node.left]
    if isinstance(node, ast.IfExp):
        return [node.body, node.orelse]
    if isinstance(node, ast.GeneratorExp | ast.ListComp):
        return [node.elt]
    return []


def _texts(node: ast.AST) -> list[Line]:
    """Returns the text of each string that makes up a message, with its line numbers."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return _split(node.value, node.lineno)
    return [line for part in _parts(node) for line in _texts(part)]


def _builds_message(func: ast.expr) -> bool:
    """Returns whether a call to ``func`` prints, logs or builds a message, or adds one to a list named problems."""
    if isinstance(func, ast.Name):
        return func.id == "print" or func.id.endswith(MESSAGE_CALLS)
    if not isinstance(func, ast.Attribute):
        return False
    if isinstance(func.value, ast.Name) and func.value.id == "problems" and func.attr in {"append", "extend"}:
        return True
    return func.attr in LOG_METHODS or func.attr.endswith(MESSAGE_CALLS)


def _message_nodes(node: ast.AST) -> list[ast.AST]:
    if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef) and node.body:
        first = node.body[0]
        return [first.value] if isinstance(first, ast.Expr) else []
    if isinstance(node, ast.Call):
        found: list[ast.AST] = [keyword.value for keyword in node.keywords if keyword.arg in MESSAGE_KEYWORDS]
        return found + list(node.args) if _builds_message(node.func) else found
    if isinstance(node, ast.Raise) and isinstance(node.exc, ast.Call):
        return list(node.exc.args)
    if isinstance(node, ast.Assign) and [getattr(target, "id", "") for target in node.targets] == ["msg"]:
        return [node.value]
    return []


def python_prose(text: str) -> list[Line]:
    """Returns the comments and docstrings of Python, and the text of the messages it prints, logs or builds."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", SyntaxWarning)
            tree = ast.parse(text)
        tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    except (SyntaxError, tokenize.TokenError) as error:
        msg = f"cannot parse: {error}"
        raise SourceError(msg) from error
    found = [(token.start[0], token.string[1:]) for token in tokens if token.type == tokenize.COMMENT]
    for node in ast.walk(tree):
        for message in _message_nodes(node):
            found.extend(_texts(message))
    return sorted(set(found))


_READERS: dict[str, Callable[[str], list[Line]]] = {
    ".md": markdown_prose,
    ".vue": vue_prose,
    ".html": vue_prose,
    ".css": css_prose,
    ".py": python_prose,
    **dict.fromkeys(SCRIPT_SUFFIXES, script_prose),
    **dict.fromkeys(HASH_SUFFIXES, hash_prose),
}
