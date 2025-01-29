import datetime
import fnmatch
import os
import re

"""
File Consolidation Script
==========================

This script consolidates files from a specified directory (and optionally its subdirectories)
into a single output file, respecting .gitignore patterns and additional custom ignore patterns.

Features:
- Reads and respects .gitignore patterns
- Supports additional custom ignore patterns
- Handles various file extensions
- Option to process child directories
- Adds file path headers in the consolidated output

Usage:
python consolidate_files.py

The script will prompt for:
1. The target directory (default: current directory)
2. File extensions to include (default: common code file extensions)
3. Whether to process child directories

Customization:
To add custom ignore patterns, modify the 'additional_ignore' string in the __main__ block.
These patterns will be applied in addition to those found in the .gitignore file.

Dependencies:
- Python 3.6+
- No external libraries required

Notes:
- Ensure you have read permissions for all directories and files you wish to consolidate.
- The script creates a new file with a timestamp in its name to avoid overwriting existing files.

Author: Steve Biggs
Last Modified: 2025.01.29
Version: 2.2
"""


class FileHandler:
    def __init__(self, default_directory: str, default_file_extensions: list[str], extra_ignores: str = ""):
        self.default_directory = default_directory
        self.default_extensions = default_file_extensions
        self.gitignore_patterns = self.read_gitignore()
        self.additional_ignore_patterns = self.parse_additional_ignore(extra_ignores)
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
                              ".eslintignore", ".stylelintignore", "package-lock.json", "package-lock.json",
                              "pnpm-lock.yaml", "yarn.lock", "index.d.ts", "index.ts"]
        self.strip_regex = [(r'/\*.*?copyright.*?\*/', re.DOTALL | re.IGNORECASE),
                            (r'^\s*import\s.*;?\s*$', re.MULTILINE), (r'\n\s*\n+', re.MULTILINE)]

    def is_generated_file(self, filename: str) -> bool:
        """Check if the file matches our generated file pattern."""
        return bool(re.match(self.generated_file_pattern, os.path.basename(filename)))

    @staticmethod
    def parse_additional_ignore(ignores: str) -> list[str]:
        return [line.strip() for line in ignores.split('\n') if
                line.strip() and not line.strip().startswith('#')]

    def get_directory(self) -> str:
        root_directory = input(f"Enter the directory (default: {self.default_directory}): ")
        if len(root_directory) == 0:
            root_directory = self.default_directory
        return root_directory

    def get_extension_list(self) -> list[str]:
        extensions = input(f"Enter the extensions using space as a separator (default: {self.default_extensions}): ")
        if len(extensions) == 0:
            return self.default_extensions
        return extensions.split()

    @staticmethod
    def read_gitignore() -> list[str]:
        gitignore_path = os.path.join(os.getcwd(), '.gitignore')
        patterns = []
        if os.path.exists(gitignore_path):
            try:
                with open(gitignore_path, 'r') as f:
                    for line in f:
                        # Remove inline comments and strip whitespace
                        line = line.split('#')[0].strip()
                        if line:  # Check if line is not empty after removing comments
                            patterns.append(line)
                print(f"Successfully read .gitignore file from {gitignore_path}")
            except IOError as e:
                print(f"Warning: Error reading .gitignore file: {e}")
        else:
            print(f"Warning: .gitignore file not found in the current directory ({os.getcwd()})")
        return patterns

    def should_ignore(self, path: str) -> bool:
        rel_path = os.path.relpath(path, self.default_directory)
        path_parts = rel_path.split(os.sep)

        for pattern in self.gitignore_patterns + self.additional_ignore_patterns:
            if pattern.startswith('!'):
                # Negation patterns are not handled in this simple implementation
                continue

            # Handle patterns starting with '/'
            if pattern.startswith('/'):
                if fnmatch.fnmatch('/' + rel_path, pattern):
                    return True
            # Handle patterns ending with '/'
            elif pattern.endswith('/'):
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
        return False

    def get_all_hierarchy_files(self, folder: str, extensions: list[str], max_size_kb: int = 128) -> list[str]:
        """Get all files in the directory hierarchy with specified extensions and below a certain size (in KB)."""

        all_files = []
        if not os.path.exists(folder) or not os.access(folder, os.R_OK):
            print(f"Directory {folder} is not accessible.")
            return all_files

        for root, dirs, file_list in os.walk(folder):
            # Combine directory filtering in one comprehension
            dirs[:] = [
                d for d in dirs
                if not self.should_ignore(os.path.join(root, d))
                   and d not in self.ignored_folders
            ]

            for file_name in file_list:
                # Skip generated files
                if self.is_generated_file(file_name):
                    continue

                # Skip extra ignored files
                if file_name in self.ignored_files:
                    print(f"Skipping extra ignored file: {file_name}")
                    continue

                full_path = os.path.join(root, file_name)

                # Check extension and ignoring rules
                if file_name.endswith(tuple(extensions)) and not self.should_ignore(full_path):
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
    def get_child_directories(folder: str) -> list[str]:
        return [os.path.join(folder, name) for name in os.listdir(folder) if os.path.isdir(os.path.join(folder, name))]

    @staticmethod
    def ask_user() -> bool:
        response = input(f"Do you want to run the script just on the child directories (separate output)? "
                         f"[y/n] (default: n): ")
        return response.lower() in ["y", "yes"]  # Default to 'n'/false if the input is empty

    def combine_files_with_path_headers(self, folder: str, files_by_path: dict[str, str],
                                        write_up_a_level: bool = True):

        # Determine output file name with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        base_dir_name = os.path.basename(folder)
        safe_dir_name = base_dir_name.replace(os.sep, "_").replace(":", "").strip("_")
        filename = f"{safe_dir_name}_{timestamp}.txt"
        if write_up_a_level:
            folder = os.path.dirname(folder)
        output_path = os.path.join(folder, filename)

        print(f"\nWriting to {output_path}")

        non_empty_files = {path: content for path, content in files_by_path.items() if content.strip()}

        if not non_empty_files:
            print("No non-empty files to write. Skipping output file creation.")
            return

        with open(output_path, 'w', encoding='utf-8') as combined_file:
            for path, text in non_empty_files.items():
                for pattern, flags in self.strip_regex:
                    text = re.sub(pattern, '', text, flags=flags)
                combined_file.write(f"\n# File: {path}\n\n{text}")

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
    ]

    file_handler = FileHandler(".", default_extensions, additional_ignore)
    directory = file_handler.get_directory()
    extension_list = file_handler.get_extension_list()

    if file_handler.ask_user():
        child_directories = file_handler.get_child_directories(directory)
        directories_to_process = child_directories
    else:
        directories_to_process = [directory]

    for current_directory in directories_to_process:
        files = file_handler.get_all_hierarchy_files(current_directory, extension_list, 64)

        file_text_contents_by_full_path = {}
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    file_text_contents_by_full_path[file_path] = file.read()
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")

        print(f"Found {len(files)} files.")

        file_handler.combine_files_with_path_headers(current_directory, file_text_contents_by_full_path)
