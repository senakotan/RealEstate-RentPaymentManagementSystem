namespace EmlakYonetimAPI.Models
{
    public class ParaBirimi
    {
        public int ParaBirimiID { get; set; }
        public string Kod { get; set; } = string.Empty; // TRY, USD...
        public string Ad { get; set; } = string.Empty;
        public string Sembol { get; set; } = string.Empty;
    }
}
