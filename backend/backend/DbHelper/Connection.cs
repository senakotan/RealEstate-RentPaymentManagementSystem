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
                ?? "";
        }

        public static SqlConnection GetConnection()
        {
            if (string.IsNullOrEmpty(_connectionString))
            {
                _connectionString = "Server=DESKTOP-CLEHOJA;Database=GayrimenkulYonetimDB;Integrated Security=True;TrustServerCertificate=True;";
            }
            return new SqlConnection(_connectionString);
        }
    }
}
