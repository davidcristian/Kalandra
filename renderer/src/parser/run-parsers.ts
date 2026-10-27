import type { Result } from "neverthrow";

export type SectionParseResult =
  | "SECTION_PARSED"
  | "SECTION_SKIPPED"
  | "PARSER_SKIPPED";

export type ParserFn<S> = (section: string[], item: S) => SectionParseResult;
export type VirtualParserFn<S> = (item: S) => Result<never, string> | void;

/** Runs the parsers in order, removes each section one parses, and returns the first error a virtual parser gives. */
export function runParsers<S>(
  list: Array<ParserFn<S> | { virtual: VirtualParserFn<S> }>,
  sections: string[][],
  item: S,
): Result<never, string> | void {
  for (const parser of list) {
    if (typeof parser === "object") {
      const error = parser.virtual(item);
      if (error) return error;
      continue;
    }
    for (const section of sections) {
      const result = parser(section, item);
      if (result === "SECTION_PARSED") {
        sections.splice(sections.indexOf(section), 1);
        break;
      } else if (result === "PARSER_SKIPPED") {
        break;
      }
    }
  }
}
