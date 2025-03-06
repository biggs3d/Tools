using System.Collections.ObjectModel;

namespace TransitionDiffTool.Shared.Models;

public class FileTreeItem
{
    public string Name { get; set; } = string.Empty;
    public string FullPath { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public bool IsSelected { get; set; }
    public ObservableCollection<FileTreeItem> Children { get; set; } = new();
} 