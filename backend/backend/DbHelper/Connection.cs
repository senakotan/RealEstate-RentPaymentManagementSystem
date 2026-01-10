using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace EmlakYonetimAPI.DbHelper
{
    public static class Connection
    {
        private static string? _connectionString;

        public static void Initialize(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=DESKTOP-CLEHOJA;Database=GayrimenkulYonetimDB;Integrated Security=True;TrustServerCertificate=True;";
        }

        public static SqlConnection GetConnection()
        {
            if (string.IsNullOrEmpty(_connectionString))
            {
                // Fallback connection string if not initialized
                _connectionString = "Server=DESKTOP-CLEHOJA;Database=GayrimenkulYonetimDB;Integrated Security=True;TrustServerCertificate=True;";
            }
            return new SqlConnection(_connectionString);
        }
    }
}
