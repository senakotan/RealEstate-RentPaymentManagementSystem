using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RolController : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Rol>>> GetRoles()
        {
            var roles = new List<Rol>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            var sql = "SELECT RolID, RolAdi, Aciklama FROM Rol";

            using var cmd = new SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                roles.Add(new Rol
                {
                    RolID = reader.GetInt32(0),
                    RolAdi = reader.GetString(1),
                    Aciklama = reader.IsDBNull(2) ? null : reader.GetString(2)
                });
            }

            return Ok(roles);
        }

        [HttpPost]
        public async Task<ActionResult> CreateRole(Rol model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            var sql = "INSERT INTO Rol (RolAdi, Aciklama) VALUES (@RolAdi, @Aciklama)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@RolAdi", model.RolAdi);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();

            return Ok("Rol eklendi.");
        }
    }
}
