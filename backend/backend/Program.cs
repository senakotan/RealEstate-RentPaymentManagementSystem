var builder = WebApplication.CreateBuilder(args);

// Initialize Connection Helper
EmlakYonetimAPI.DbHelper.Connection.Initialize(builder.Configuration);

// Controllers - JSON se�eneklerini yap�land�r (camelCase/PascalCase deste�i)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// NET 9 OpenAPI (Swagger)
builder.Services.AddOpenApi();  // ? yeni y�ntem

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("allowFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Global Error Handling Middleware
app.UseMiddleware<EmlakYonetimAPI.Middleware.ErrorHandlingMiddleware>();

// Development ortam�nda Swagger a�
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();             // ? yeni swagger endpointi
    
}

app.UseHttpsRedirection();

// Static files (uploaded files i�in)
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")),
    RequestPath = "/uploads"
});

app.UseCors("allowFrontend");

app.MapControllers();

app.Run();
