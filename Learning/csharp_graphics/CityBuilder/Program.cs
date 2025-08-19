using CityBuilder.Core;

namespace CityBuilder;

class Program
{
    static void Main(string[] args)
    {
        // Create and run the game
        using (var game = new Game(1280, 720, "City Builder - Prototype"))
        {
            try
            {
                game.Initialize();
                game.Run();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Fatal error: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
            }
        }
        
        Console.WriteLine("Application terminated");
    }
}
