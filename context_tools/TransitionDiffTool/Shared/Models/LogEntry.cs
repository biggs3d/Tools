namespace TransitionDiffTool.Shared.Models;

public class LogEntry
{
    public string Message { get; set; } = string.Empty;
    public LogType Type { get; set; }
    public DateTime Timestamp { get; set; }
}

public enum LogType
{
    Info,
    Warning,
    Error
} 