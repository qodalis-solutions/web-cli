use wasm_bindgen::prelude::*;
use regex::Regex;
use std::cell::RefCell;
use std::collections::HashMap;

/// Boyer-Moore-Horspool text search across newline-separated text.
/// Returns [row, col] of first match from (start_row, start_col), or [-1, -1].
#[wasm_bindgen]
pub fn text_search(
    text: &str,
    needle: &str,
    start_row: usize,
    start_col: usize,
    case_sensitive: bool,
    wrap: bool,
) -> Vec<i32> {
    if needle.is_empty() {
        return vec![-1, -1];
    }

    let lines: Vec<&str> = text.split('\n').collect();
    let total = lines.len();

    let needle_owned;
    let search_needle = if case_sensitive {
        needle
    } else {
        needle_owned = needle.to_lowercase();
        needle_owned.as_str()
    };

    let needle_bytes = search_needle.as_bytes();
    let nlen = needle_bytes.len();

    // Build Boyer-Moore-Horspool bad character table
    let mut shift = [nlen; 256];
    for i in 0..nlen - 1 {
        shift[needle_bytes[i] as usize] = nlen - 1 - i;
    }

    // Search from start_row to end
    for row in start_row..total {
        let line = lines[row];
        let haystack = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        let hay = haystack.as_bytes();
        let from = if row == start_row { start_col + 1 } else { 0 };

        if let Some(col) = bmh_search(hay, needle_bytes, &shift, from) {
            return vec![row as i32, col as i32];
        }
    }

    if !wrap {
        return vec![-1, -1];
    }

    // Wrap around from beginning to start_row
    for row in 0..=start_row {
        let line = lines[row];
        let haystack = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        let hay = haystack.as_bytes();
        let end_col = if row == start_row {
            start_col
        } else {
            haystack.len()
        };

        if let Some(col) = bmh_search(hay, needle_bytes, &shift, 0) {
            if row < start_row || col < end_col {
                return vec![row as i32, col as i32];
            }
        }
    }

    vec![-1, -1]
}

/// Replace all occurrences of needle in text.
/// Returns "count\n<new_text>" to avoid multiple return values.
#[wasm_bindgen]
pub fn text_replace_all(
    text: &str,
    needle: &str,
    replacement: &str,
    case_sensitive: bool,
) -> String {
    if needle.is_empty() {
        return format!("0\n{}", text);
    }

    let lines: Vec<&str> = text.split('\n').collect();
    let mut result_lines: Vec<String> = Vec::with_capacity(lines.len());
    let mut count: usize = 0;

    let needle_owned;
    let search_needle = if case_sensitive {
        needle
    } else {
        needle_owned = needle.to_lowercase();
        needle_owned.as_str()
    };

    let nlen = needle.len();
    let needle_bytes = search_needle.as_bytes();

    let mut shift_table = [nlen; 256];
    for i in 0..nlen - 1 {
        shift_table[needle_bytes[i] as usize] = nlen - 1 - i;
    }

    for line in lines {
        let hay_owned;
        let haystack: &str = if case_sensitive {
            line
        } else {
            hay_owned = line.to_lowercase();
            hay_owned.as_str()
        };

        let hay = haystack.as_bytes();
        let src = line.as_bytes();
        let mut new_line = Vec::new();
        let mut pos = 0;

        while pos + nlen <= hay.len() {
            if let Some(idx) = bmh_search(hay, needle_bytes, &shift_table, pos) {
                new_line.extend_from_slice(&src[pos..idx]);
                new_line.extend_from_slice(replacement.as_bytes());
                pos = idx + nlen;
                count += 1;
            } else {
                break;
            }
        }
        new_line.extend_from_slice(&src[pos..]);
        result_lines.push(String::from_utf8_lossy(&new_line).to_string());
    }

    format!("{}\n{}", count, result_lines.join("\n"))
}

/// Batch prefix matching for tab completion.
/// candidates: newline-separated. Returns newline-separated sorted matches.
#[wasm_bindgen]
pub fn prefix_match(candidates: &str, prefix: &str) -> String {
    if prefix.is_empty() {
        let mut all: Vec<&str> = candidates.split('\n').filter(|s| !s.is_empty()).collect();
        all.sort_unstable();
        return all.join("\n");
    }

    let prefix_lower = prefix.to_lowercase();
    let mut matches: Vec<&str> = candidates
        .split('\n')
        .filter(|s| !s.is_empty() && s.to_lowercase().starts_with(&prefix_lower))
        .collect();

    matches.sort_unstable();
    matches.join("\n")
}

/// Longest common prefix of newline-separated strings.
#[wasm_bindgen]
pub fn common_prefix(strings: &str) -> String {
    let items: Vec<&str> = strings.split('\n').filter(|s| !s.is_empty()).collect();
    if items.is_empty() {
        return String::new();
    }

    let first = items[0].as_bytes();
    let mut len = first.len();

    for item in &items[1..] {
        let bytes = item.as_bytes();
        len = len.min(bytes.len());
        for i in 0..len {
            if first[i] != bytes[i] {
                len = i;
                break;
            }
        }
        if len == 0 {
            return String::new();
        }
    }

    items[0][..len].to_string()
}

// ── Syntax highlighting tokenizer ────────────────────────────────────

struct CompiledRule {
    pattern: Regex,
    token_type: String,
    capture_group: usize,
}

thread_local! {
    static RULE_SETS: RefCell<HashMap<String, Vec<CompiledRule>>> = RefCell::new(HashMap::new());
}

#[wasm_bindgen]
pub fn register_rule_set(rule_set_id: &str, rules: &str) {
    let mut compiled = Vec::new();
    for line in rules.split('\n') {
        if line.is_empty() { continue; }
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 2 { continue; }
        match Regex::new(parts[0]) {
            Ok(re) => {
                let cg = if parts.len() > 2 {
                    parts[2].parse::<usize>().unwrap_or(0)
                } else {
                    0
                };
                compiled.push(CompiledRule {
                    pattern: re,
                    token_type: parts[1].to_string(),
                    capture_group: cg,
                });
            }
            Err(_) => {} // skip invalid regex
        }
    }
    RULE_SETS.with(|rs| {
        rs.borrow_mut().insert(rule_set_id.to_string(), compiled);
    });
}

#[wasm_bindgen]
pub fn tokenize_line(line: &str, rule_set_id: &str) -> String {
    RULE_SETS.with(|rs| {
        let sets = rs.borrow();
        let rules = match sets.get(rule_set_id) {
            Some(r) => r,
            None => return String::new(),
        };

        if line.is_empty() || rules.is_empty() {
            return String::new();
        }

        let mut tokens: Vec<String> = Vec::new();
        let mut pos = 0;
        let line_len = line.len();

        while pos < line_len {
            let mut found = false;
            for rule in rules.iter() {
                if let Some(m) = rule.pattern.find_at(line, pos) {
                    let (start, end) = if rule.capture_group > 0 {
                        if let Some(caps) = rule.pattern.captures_at(line, pos) {
                            if let Some(group) = caps.get(rule.capture_group) {
                                (group.start(), group.end())
                            } else {
                                (m.start(), m.end())
                            }
                        } else {
                            (m.start(), m.end())
                        }
                    } else {
                        (m.start(), m.end())
                    };

                    if m.end() > pos {
                        tokens.push(format!("{},{},{}", start, end, rule.token_type));
                        pos = m.end();
                        found = true;
                        break;
                    }
                }
            }
            if !found {
                pos += 1;
                // Advance past multi-byte UTF-8 characters
                while pos < line_len && !line.is_char_boundary(pos) {
                    pos += 1;
                }
            }
        }

        tokens.join("\n")
    })
}

/// Boyer-Moore-Horspool search within a single haystack.
fn bmh_search(hay: &[u8], needle: &[u8], shift: &[usize; 256], from: usize) -> Option<usize> {
    let hlen = hay.len();
    let nlen = needle.len();
    if nlen == 0 || from + nlen > hlen {
        return None;
    }

    let mut i = from;
    while i + nlen <= hlen {
        let mut j = nlen - 1;
        while hay[i + j] == needle[j] {
            if j == 0 {
                return Some(i);
            }
            j -= 1;
        }
        i += shift[hay[i + nlen - 1] as usize];
    }

    None
}
