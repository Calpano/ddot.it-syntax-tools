// Chroma conformance: load the XML lexer in ../../chroma/ddot.xml, tokenize
// every ../../../ddot.it/test-data/cases/*/input.ddot, map Chroma token types
// to canonical names, and assert byte equality against expected.tokens.json.
//
// Designed to run inside a `golang:1.23` Docker container with the repo
// mounted at /work — no Go toolchain on the host.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/alecthomas/chroma/v2"
)

// Chroma token type → canonical name (see test-data/tokens.md).
var tokenToCanonical = map[chroma.TokenType]string{
	chroma.NameClass:            "subject",
	chroma.NameFunction:         "relation",
	chroma.LiteralStringSymbol:  "object",
	chroma.Operator:             "operator",
	chroma.KeywordPseudo:        "command",
	chroma.CommentPreproc:       "meta-delim",
	chroma.CommentHashbang:      "meta-operator",
	chroma.NameAttribute:        "meta-relation",
	chroma.LiteralStringHeredoc: "meta-object",
	chroma.CommentMultiline:     "meta-text",
	chroma.CommentSingle:        "disabled",
}

type goldenTok struct {
	Line  int    `json:"line"`
	Start int    `json:"start"`
	End   int    `json:"end"`
	Token string `json:"token"`
	Text  string `json:"text"`
}

func tokenizeCanonical(src string, lexer chroma.Lexer) ([]goldenTok, error) {
	it, err := lexer.Tokenise(nil, src)
	if err != nil {
		return nil, err
	}
	out := make([]goldenTok, 0, 64)
	line, col := 0, 0
	for tok := it(); tok != chroma.EOF; tok = it() {
		val := tok.Value
		i := 0
		for i < len(val) {
			nl := strings.IndexByte(val[i:], '\n')
			if nl == -1 {
				chunk := val[i:]
				if chunk != "" {
					if canon, ok := tokenToCanonical[tok.Type]; ok && strings.TrimSpace(chunk) != "" {
						out = append(out, goldenTok{
							Line:  line,
							Start: col,
							End:   col + len(chunk),
							Token: canon,
							Text:  chunk,
						})
					}
					col += len(chunk)
				}
				break
			}
			chunk := val[i : i+nl]
			if chunk != "" {
				if canon, ok := tokenToCanonical[tok.Type]; ok && strings.TrimSpace(chunk) != "" {
					out = append(out, goldenTok{
						Line:  line,
						Start: col,
						End:   col + len(chunk),
						Token: canon,
						Text:  chunk,
					})
				}
			}
			line++
			col = 0
			i += nl + 1
		}
	}
	return out, nil
}

func diffTokens(actual, expected []goldenTok) []string {
	var lines []string
	n := len(actual)
	if len(expected) > n {
		n = len(expected)
	}
	for i := 0; i < n; i++ {
		var a, e *goldenTok
		if i < len(actual) {
			a = &actual[i]
		}
		if i < len(expected) {
			e = &expected[i]
		}
		if a != nil && e != nil && *a == *e {
			continue
		}
		lines = append(lines, fmt.Sprintf("  #%d", i))
		lines = append(lines, "    expected: "+jsonOrNone(e))
		lines = append(lines, "    actual:   "+jsonOrNone(a))
		if len(lines) > 30 {
			break
		}
	}
	return lines
}

func jsonOrNone(t *goldenTok) string {
	if t == nil {
		return "(none)"
	}
	b, _ := json.Marshal(t)
	return string(b)
}

func mustReadDir(p string) []os.DirEntry {
	entries, err := os.ReadDir(p)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cases dir not found: %s\n", p)
		os.Exit(2)
	}
	return entries
}

func main() {
	// We expect to run from the repo root inside the container, e.g.
	//   docker run -v $PWD:/work -w /work golang:1.23 go run ./tools/conformance-chroma
	cwd, _ := os.Getwd()
	repoRoot := cwd
	// If invoked from elsewhere, walk up to find textmate/ as a marker.
	for {
		if _, err := os.Stat(filepath.Join(repoRoot, "textmate", "ddot.tmLanguage.json")); err == nil {
			break
		}
		parent := filepath.Dir(repoRoot)
		if parent == repoRoot {
			fmt.Fprintln(os.Stderr, "couldn't locate ddot.it-syntax-tools repo root")
			os.Exit(2)
		}
		repoRoot = parent
	}

	xmlDir := filepath.Join(repoRoot, "chroma")
	parsedLexer, err := chroma.NewXMLLexer(os.DirFS(xmlDir), "ddot.xml")
	if err != nil {
		fmt.Fprintf(os.Stderr, "load chroma/ddot.xml: %v\n", err)
		os.Exit(2)
	}

	casesDir := filepath.Join(repoRoot, "..", "ddot.it", "test-data", "cases")
	entries := mustReadDir(casesDir)

	caseNames := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			caseNames = append(caseNames, e.Name())
		}
	}
	sort.Strings(caseNames)

	var failures []string
	for _, name := range caseNames {
		dir := filepath.Join(casesDir, name)
		input, err := os.ReadFile(filepath.Join(dir, "input.ddot"))
		if err != nil {
			fmt.Printf("skip  %s\n", name)
			continue
		}
		expectedRaw, err := os.ReadFile(filepath.Join(dir, "expected.tokens.json"))
		if err != nil {
			fmt.Printf("skip  %s\n", name)
			continue
		}
		var expected []goldenTok
		if err := json.Unmarshal(expectedRaw, &expected); err != nil {
			fmt.Fprintf(os.Stderr, "%s: bad expected.tokens.json: %v\n", name, err)
			failures = append(failures, name)
			continue
		}
		actual, err := tokenizeCanonical(string(input), parsedLexer)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s: tokenize: %v\n", name, err)
			failures = append(failures, name)
			continue
		}
		if equalTokens(actual, expected) {
			fmt.Printf("ok    %s\n", name)
			continue
		}
		failures = append(failures, name)
		fmt.Printf("FAIL  %s\n", name)
		for _, l := range diffTokens(actual, expected) {
			fmt.Println(l)
		}
	}

	if len(failures) > 0 {
		fmt.Fprintf(os.Stderr, "\n%d/%d cases diverge: %s\n", len(failures), len(caseNames), strings.Join(failures, ", "))
		os.Exit(1)
	}
	fmt.Printf("\nall %d cases pass\n", len(caseNames))
}

func equalTokens(a, b []goldenTok) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
