import datetime
import fnmatch
import os
import re
from typing import Dict, List, Set, Tuple

"""
File Consolidation Script
==========================

This script consolidates files from a specified directory (and optionally its subdirectories)
into a single output file, respecting .gitignore patterns throughout the directory hierarchy.

Features:
- Reads and respects .gitignore patterns from all subdirectories
- Supports additional custom ignore patterns
- Handles various file extensions
- Option to process child directories
- Adds file path headers in the consolidated output
- Option to enable/disable gitignore processing

Usage:
python consolidate_files.py

The script will prompt for:
1. The target directory (default: current directory)
2. Whether to respect .gitignore files (default: yes)
3. File extensions to include (default: common code file extensions)
4. Whether to process child directories

Customization:
To add custom ignore patterns, modify the 'additional_ignore' string in the __main__ block.
These patterns will be applied in addition to those found in the .gitignore files.

Dependencies:
- Python 3.6+
- No external libraries required

Notes:
- Ensure you have read permissions for all directories and files you wish to consolidate.
- The script creates a new file with a timestamp in its name to avoid overwriting existing files.
- .gitignore files are processed hierarchically, with each file affecting only its directory and subdirectories.

Author: Steve Biggs
Last Modified: 2025.06.05
Version: 3.0
"""


class GitIgnoreManager:
    """Manages gitignore patterns hierarchically throughout the directory structure."""

    def __init__(self, root_directory: str, respect_gitignore: bool = True):
        self.root_directory = os.path.abspath(root_directory)
        self.respect_gitignore = respect_gitignore
        # Dictionary mapping directory paths to their gitignore patterns
        self.gitignore_patterns_by_dir: Dict[str, List[str]] = {}
        # Cache for pattern matching results
        self._match_cache: Dict[Tuple[str, str], bool] = {}

        if self.respect_gitignore:
            self._load_all_gitignore_files()

    def _load_all_gitignore_files(self):
        """Load all .gitignore files in the directory tree."""
        for root, dirs, files in os.walk(self.root_directory):
            if '.gitignore' in files:
                gitignore_path = os.path.join(root, '.gitignore')
                patterns = self._read_gitignore_file(gitignore_path)
                if patterns:
                    self.gitignore_patterns_by_dir[root] = patterns
                    print(f"Loaded .gitignore from: {os.path.relpath(root, self.root_directory)}")

    @staticmethod
    def _read_gitignore_file(gitignore_path: str) -> List[str]:
        """Read patterns from a single .gitignore file."""
        patterns = []
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                for line in f:
                    # Remove inline comments and strip whitespace
                    line = line.split('#')[0].strip()
                    if line and not line.startswith('!'):  # Skip empty lines and negation patterns
                        patterns.append(line)
        except IOError as e:
            print(f"Warning: Error reading .gitignore file {gitignore_path}: {e}")
        return patterns

    def should_ignore(self, path: str) -> bool:
        """Check if a path should be ignored based on gitignore patterns."""
        if not self.respect_gitignore:
            return False

        abs_path = os.path.abspath(path)

        cache_key = (abs_path, self.root_directory)
        if cache_key in self._match_cache:
            return self._match_cache[cache_key]

        current_dir = os.path.dirname(abs_path)
        # If checking a directory, use its own path for gitignore hierarchy.
        # If checking a file, start from its parent.
        # For consistency with how gitignore applies to contents of a dir,
        # if abs_path is a dir, its patterns apply from its own .gitignore.
        # If abs_path is a file, patterns apply from parent .gitignores.

        # The loop should check .gitignore files from the item's directory upwards for files,
        # and from the item's parent directory upwards for directories (as git usually does).
        # However, current logic checks from os.path.dirname(abs_path) upwards.
        # For a file `root/a/b/file.txt`, current_dir starts at `root/a/b`.
        # For a dir `root/a/b/`, current_dir starts at `root/a/b`.
        # This seems okay. A .gitignore in `root/a/b/` applies to `root/a/b/file.txt`
        # and also to `root/a/b/` itself (e.g. if it contains `/b/`).

        path_to_check_against_gitignore = abs_path

        # Iterate from the directory containing the item, up to the root_directory
        # For an item /a/b/c.txt, current_dir_iter starts at /a/b
        # For an item /a/b/d/ (a dir), current_dir_iter starts at /a/b/d

        # Let's adjust current_dir_iter to be the directory where the .gitignore would be located
        # For a file /foo/bar/baz.txt, we check .gitignores in /foo/bar, /foo, /
        # For a directory /foo/bar/baz/, we check .gitignores in /foo/bar/baz, /foo/bar, /foo, /

        dir_of_item = os.path.dirname(path_to_check_against_gitignore)
        if os.path.isdir(path_to_check_against_gitignore):
            # If path_to_check_against_gitignore is a directory, start search for .gitignore in this directory itself
            current_dir_iter = path_to_check_against_gitignore
        else:
            # If it's a file, start search for .gitignore in its parent directory
            current_dir_iter = dir_of_item

        while current_dir_iter.startswith(self.root_directory) and len(current_dir_iter) >= len(self.root_directory):
            if current_dir_iter in self.gitignore_patterns_by_dir:
                rel_path = os.path.relpath(path_to_check_against_gitignore, current_dir_iter)
                # Pass abs_path (the absolute path of the item being checked) to _matches_patterns
                if self._matches_patterns(rel_path, self.gitignore_patterns_by_dir[current_dir_iter], abs_path):
                    self._match_cache[cache_key] = True
                    return True

            if current_dir_iter == self.root_directory:  # Stop if we are at the root and have checked it
                break

            parent = os.path.dirname(current_dir_iter)
            if parent == current_dir_iter:  # Reached filesystem root or an unresolvable state
                break
            current_dir_iter = parent

        self._match_cache[cache_key] = False
        return False

    @staticmethod
    def _matches_patterns(rel_path: str, patterns: List[str], item_abs_path: str) -> bool:
        """Check if a relative path matches any of the given patterns."""
        # Normalize rel_path to use forward slashes for matching.
        normalized_rel_path = rel_path.replace(os.sep, '/')
        if not normalized_rel_path:
            pass

        path_parts = normalized_rel_path.split('/')

        for pattern_str in patterns:
            processed_pattern = pattern_str.strip()
            if not processed_pattern or processed_pattern.startswith('#'):
                continue

            if processed_pattern.startswith('/'):
                anchor_pattern_segment = processed_pattern[1:]
                if not anchor_pattern_segment:
                    continue

                if anchor_pattern_segment.endswith('/'):
                    dir_name = anchor_pattern_segment[:-1]
                    if not dir_name:
                        continue
                    if fnmatch.fnmatch(normalized_rel_path, dir_name) or \
                            fnmatch.fnmatch(normalized_rel_path, dir_name + '/*'):
                        return True
                else:
                    if fnmatch.fnmatch(normalized_rel_path, anchor_pattern_segment):
                        return True
            elif processed_pattern.endswith('/'):
                dir_pattern_base = processed_pattern[:-1]
                if not dir_pattern_base:
                    continue

                # Check if the item itself is a directory and its name matches,
                # or if the path starts with dir_pattern_base/
                # or if dir_pattern_base is one of the directory components in the path.
                is_item_a_dir = os.path.isdir(item_abs_path)

                # Case 1: Pattern "foo/", path "foo" (and foo is a directory)
                if normalized_rel_path == dir_pattern_base and is_item_a_dir:
                    return True
                # Case 2: Pattern "foo/", path "foo/bar.txt" or "a/foo/bar.txt"
                if normalized_rel_path.startswith(dir_pattern_base + '/') or \
                        any(p == dir_pattern_base and (
                                i < len(path_parts) - 1 or (i == len(path_parts) - 1 and is_item_a_dir)) for i, p in
                            enumerate(path_parts)):
                    # If 'dir_pattern_base' is a component and it represents a directory in the path structure
                    # This part ensures that if 'foo/' is the pattern, 'foo' must be a directory.
                    # We check if 'item_abs_path' is a directory if 'dir_pattern_base' is the last part.
                    # Or if 'dir_pattern_base' is an intermediate part, it's implicitly a directory.

                    # A simpler interpretation for "dir/" is that it matches a directory "dir" anywhere.
                    # If any part of the path matches 'dir_pattern_base' and that part represents a directory.
                    # fnmatch can check against components.
                    # If path is 'a/b/c' and pattern is 'b/', then 'b' component must be a dir.
                    # The check `os.path.isdir(item_abs_path)` is crucial if `dir_pattern_base` is the last component of `normalized_rel_path`.

                    # Refined logic for 'dir_pattern_base/'
                    # It matches if 'dir_pattern_base' is a name of a directory in 'normalized_rel_path'.
                    # 1. Path is exactly 'dir_pattern_base' and item_abs_path is a directory.
                    if path_parts[-1] == dir_pattern_base and is_item_a_dir and len(
                            path_parts) == 1:  # e.g. path "foo", pattern "foo/"
                        if fnmatch.fnmatch(path_parts[-1],
                                           dir_pattern_base):  # Redundant if path_parts[-1] == dir_pattern_base
                            return True
                    # 2. Path is '.../dir_pattern_base' and item_abs_path is a directory (matching the end)
                    if path_parts[-1] == dir_pattern_base and is_item_a_dir:
                        # Check if any segment matches, and if it's the last segment, ensure it's a dir
                        if fnmatch.fnmatch(path_parts[-1], dir_pattern_base):
                            return True
                    # 3. Path is '.../dir_pattern_base/...' (matching an intermediate directory)
                    #    or path starts with 'dir_pattern_base/...'
                    if normalized_rel_path.startswith(dir_pattern_base + '/') or \
                            any(p == dir_pattern_base for p in path_parts[:-1]):  # Check intermediate parts
                        if fnmatch.fnmatch(normalized_rel_path, dir_pattern_base + '/*') or \
                                fnmatch.fnmatch(normalized_rel_path, '*/' + dir_pattern_base + '/*'):
                            return True
                    # Fallback to original broader logic if specific checks didn't catch it,
                    # ensuring 'dir_pattern_base' matches a directory component.
                    if any(fnmatch.fnmatch(part, dir_pattern_base) for part in path_parts):
                        # This is true if 'dir_pattern_base' matches any segment.
                        # We need to ensure this segment corresponds to a directory.
                        # If 'item_abs_path' is '.../dir_pattern_base/file.txt', then 'dir_pattern_base' is a dir.
                        # If 'item_abs_path' is '.../dir_pattern_base' and it's a dir, it matches.
                        # This check is complex to get 100% git-compatible.
                        # A common behavior: "foo/" matches a directory "foo" and everything under it.
                        # If `normalized_rel_path` is "foo" and `item_abs_path` is a dir, it matches.
                        # If `normalized_rel_path` is "foo/bar", it matches.
                        # If `normalized_rel_path` is "baz/foo/bar", it matches.
                        if (normalized_rel_path == dir_pattern_base and os.path.isdir(item_abs_path)) or \
                                normalized_rel_path.startswith(dir_pattern_base + '/') or \
                                (('/' + dir_pattern_base + '/') in ('/' + normalized_rel_path + '/')):
                            return True


            elif '/' in processed_pattern:
                if fnmatch.fnmatch(normalized_rel_path, processed_pattern):
                    return True
            else:
                if any(fnmatch.fnmatch(part, processed_pattern) for part in path_parts):
                    return True
        return False


class FileHandler:
    def __init__(self, default_directory: str, default_file_extensions: List[str],
                 extra_ignores: str = "", respect_gitignore: bool = True):
        self.default_directory = default_directory
        self.default_extensions = default_file_extensions
        self.additional_ignore_patterns = self.parse_additional_ignore(extra_ignores)
        self.gitignore_manager = None  # Will be initialized after getting directory
        self.respect_gitignore = respect_gitignore

        # Pattern for generated files: directory_name_YYYYMMDD_HHMMSS.txt
        self.generated_file_pattern = r'^[^_]+_\d{8}_\d{6}\.txt$'
        self.ignored_folders = [".git", ".venv", "build", "Cesium", ".run", ".github", ".yalc",
                                ".yarn", ".pnpm", ".turbo", ".nx", ".idea", ".vscode",
                                "spec", "specs", "node_modules", "__pycache__", ".DS_Store",
                                ".vscode-test", ".vscode-server", ".vscode-server-insiders", ".history"]
        self.ignored_files = [".DS_Store", ".gitkeep", ".gitignore", ".gitattributes", ".editorconfig",
                              ".prettierignore", "index.mjs", ".babelrc", ".babelrc.json", ".babelrc.js",
                              ".prettier", ".stylelintrc", ".eslintrc", ".eslintrc.json", ".eslintrc.js",
                              ".eslintrc.cjs", ".eslintrc.ts", ".eslintrc.yaml", ".eslintrc.yml",
                              ".eslintignore", ".stylelintignore", "package-lock.json",
                              "pnpm-lock.yaml", "yarn.lock", "index.d.ts", "index.ts"]
        self.strip_regex = [(r'/\*.*?copyright.*?\*/', re.DOTALL | re.IGNORECASE),
                            (r'^\s*import\s.*;?\s*$', re.MULTILINE),
                            (r'\n\s*\n+', re.MULTILINE)]

    def initialize_gitignore_manager(self, directory: str):
        """Initialize the GitIgnoreManager with the target directory."""
        self.gitignore_manager = GitIgnoreManager(directory, self.respect_gitignore)

    def is_generated_file(self, filename: str) -> bool:
        """Check if the file matches our generated file pattern."""
        return bool(re.match(self.generated_file_pattern, os.path.basename(filename)))

    @staticmethod
    def parse_additional_ignore(ignores: str) -> List[str]:
        return [line.strip() for line in ignores.split('\n') if
                line.strip() and not line.strip().startswith('#')]

    def get_directory(self) -> str:
        root_directory = input(f"Enter the directory (default: {self.default_directory}): ")
        if len(root_directory) == 0:
            root_directory = self.default_directory
        return os.path.abspath(root_directory)

    @staticmethod
    def ask_respect_gitignore() -> bool:
        """Ask if the user wants to respect .gitignore files."""
        response = input("Respect .gitignore files throughout the directory structure? [Y/n] (default: Y): ")
        return response.lower() not in ["n", "no"]

    def get_extension_list(self) -> List[str]:
        extensions = input(f"Enter the extensions using space as a separator (default: {self.default_extensions}): ")
        if len(extensions) == 0:
            return self.default_extensions
        return extensions.split()

    def should_ignore_additional(self, path: str) -> bool:
        """Check if path matches additional ignore patterns."""
        rel_path = os.path.relpath(path, self.default_directory)
        path_parts = rel_path.split(os.sep)

        for pattern in self.additional_ignore_patterns:
            # Handle patterns ending with '/'
            if pattern.endswith('/'):
                if any(fnmatch.fnmatch(part, pattern[:-1]) for part in path_parts):
                    return True
            # Handle patterns with '/'
            elif '/' in pattern:
                if fnmatch.fnmatch(rel_path, pattern):
                    return True
            # Handle simple patterns
            else:
                if any(fnmatch.fnmatch(part, pattern) for part in path_parts):
                    return True
                # Also check just the filename
                if fnmatch.fnmatch(os.path.basename(path), pattern):
                    return True
        return False

    def get_all_hierarchy_files(self, folder: str, extensions: List[str], max_size_kb: int = 128) -> List[str]:
        """Get all files in the directory hierarchy with specified extensions and below a certain size (in KB)."""
        all_files = []
        if not os.path.exists(folder) or not os.access(folder, os.R_OK):
            print(f"Directory {folder} is not accessible.")
            return all_files

        for root, dirs, file_list in os.walk(folder):
            # Filter directories
            filtered_dirs = []
            for d in dirs:
                dir_path = os.path.join(root, d)
                # Check gitignore
                if self.gitignore_manager and self.gitignore_manager.should_ignore(dir_path):
                    print(f"Skipping gitignored directory: {os.path.relpath(dir_path, folder)}")
                    continue
                # Check additional patterns
                if self.should_ignore_additional(dir_path):
                    print(f"Skipping additionally ignored directory: {os.path.relpath(dir_path, folder)}")
                    continue
                # Check hardcoded ignored folders
                if d in self.ignored_folders:
                    continue
                filtered_dirs.append(d)

            dirs[:] = filtered_dirs

            for file_name in file_list:
                # Skip generated files
                if self.is_generated_file(file_name):
                    continue

                # Skip extra ignored files
                if file_name in self.ignored_files:
                    continue

                full_path = os.path.join(root, file_name)

                # Check extension
                if not file_name.endswith(tuple(extensions)):
                    continue

                # Check gitignore
                if self.gitignore_manager and self.gitignore_manager.should_ignore(full_path):
                    print(f"Skipping gitignored file: {os.path.relpath(full_path, folder)}")
                    continue

                # Check additional patterns
                if self.should_ignore_additional(full_path):
                    print(f"Skipping additionally ignored file: {os.path.relpath(full_path, folder)}")
                    continue

                if os.access(full_path, os.R_OK):
                    file_size = os.path.getsize(full_path)  # bytes
                    file_size_kb = file_size / 1024.0

                    # Skip files larger than our cutoff
                    if file_size_kb > max_size_kb:
                        print(f"Skipping large file: {full_path} ({file_size_kb:.2f} KB)")
                        continue

                    # Skip empty files
                    if file_size == 0:
                        print(f"Skipping empty file: {full_path}")
                        continue

                    # Everything passed checks, add to our list
                    all_files.append(full_path)
                else:
                    print(f"File {full_path} is not readable.")

        # Exclude this script from the returned list
        return [f for f in all_files if "consolidate.py" not in f]

    @staticmethod
    def get_child_directories(folder: str) -> List[str]:
        return [os.path.join(folder, name) for name in os.listdir(folder)
                if os.path.isdir(os.path.join(folder, name))]

    @staticmethod
    def ask_process_child_dirs() -> bool:
        response = input("Do you want to run the script just on the child directories (separate output)? "
                         "[y/n] (default: n): ")
        return response.lower() in ["y", "yes"]

    def combine_files_with_path_headers(self, folder: str, files_by_path: Dict[str, str],
                                        write_up_a_level: bool = True):
        # Determine output file name with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        base_dir_name = os.path.basename(folder)
        safe_dir_name = base_dir_name.replace(os.sep, "_").replace(":", "").strip("_")
        filename = f"{safe_dir_name}_{timestamp}.txt"
        if write_up_a_level:
            output_folder = os.path.dirname(folder)
        else:
            output_folder = folder
        output_path = os.path.join(output_folder, filename)

        print(f"\nWriting to {output_path}")

        non_empty_files = {path: content for path, content in files_by_path.items() if content.strip()}

        if not non_empty_files:
            print("No non-empty files to write. Skipping output file creation.")
            return

        with open(output_path, 'w', encoding='utf-8') as combined_file:
            # Write header with settings information
            combined_file.write(f"# Files Consolidation Output\n")
            combined_file.write(f"# {'=' * 20}\n\n")

            for path, text in non_empty_files.items():
                # Apply regex stripping
                for pattern, flags in self.strip_regex:
                    text = re.sub(pattern, '', text, flags=flags)

                # Write relative path for better readability
                rel_path = os.path.relpath(path, folder)
                combined_file.write(f"\n# File: {rel_path}\n\n{text}")

        print(f"Successfully wrote {len(non_empty_files)} non-empty files to {output_path}")


additional_ignore = """
package-lock.*
*.min.js
*.min.css
node_modules/
dist/
build/
"""

if __name__ == "__main__":
    default_extensions = [
        "c", "h", "cpp", "hpp", "txt", "md",
        "py", "java", "js", "html", "css", "json", "xml", "yaml",
        "cs", "sh", "bat",
        "razor", "cshtml", "vbhtml",
        "js", "ts", "tsx", "jsx",
        "idl",
        # FACE-specific additions
        "face", "acfg", "stg",
        # Ada
        "adb", "ads",
        # Build/config
        "cmake", "mak", "cfg", "ini", "properties", "def",
        # Documentation
        "adoc", "rst",
        # Testing
        "gold", "javagold",
        # Generated
        "hh", "cc",
        # Scripts
        "ps1", "psm1",
        # Protocol definitions
        "proto", "thrift"
    ]

    file_handler = FileHandler(".", default_extensions, additional_ignore)

    # Get user inputs
    directory = file_handler.get_directory()
    respect_gitignore = file_handler.ask_respect_gitignore()
    file_handler.respect_gitignore = respect_gitignore

    # Initialize gitignore manager after getting directory
    file_handler.initialize_gitignore_manager(directory)

    extension_list = file_handler.get_extension_list()
    process_child_dirs = file_handler.ask_process_child_dirs()

    if process_child_dirs:
        child_directories = file_handler.get_child_directories(directory)
        directories_to_process = child_directories
    else:
        directories_to_process = [directory]

    for current_directory in directories_to_process:
        print(f"\nProcessing directory: {current_directory}")
        files = file_handler.get_all_hierarchy_files(current_directory, extension_list, 64)

        file_text_contents_by_full_path = {}
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    file_text_contents_by_full_path[file_path] = file.read()
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")

        print(f"Found {len(files)} files in {os.path.basename(current_directory)}.")

        file_handler.combine_files_with_path_headers(current_directory, file_text_contents_by_full_path)
