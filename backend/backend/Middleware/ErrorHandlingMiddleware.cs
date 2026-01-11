using System.Net;
using System.Text.Json;
using System.Collections.Generic;
using Microsoft.Data.SqlClient;

namespace EmlakYonetimAPI.Middleware
{
    public class ErrorHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorHandlingMiddleware> _logger;

        public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bir hata oluştu: {Message}", ex.Message);
                await HandleExceptionAsync(context, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            var code = HttpStatusCode.InternalServerError;
            var message = "Bir hata oluştu. Lütfen daha sonra tekrar deneyin.";

            if (exception is SqlException sqlEx)
            {
                code = HttpStatusCode.BadRequest;
                
                if (sqlEx.Number == 547)
                {
                    message = "Bu kayıt başka bir tabloda kullanıldığı için silinemez veya değiştirilemez. Lütfen önce ilişkili kayıtları kontrol edin.";
                }
                
                else if (sqlEx.Number == 2601 || sqlEx.Number == 2627)
                {
                    if (sqlEx.Message.Contains("Email") || sqlEx.Message.Contains("email"))
                    {
                        message = "Bu e-posta adresi zaten sistemde kayıtlı. Lütfen farklı bir e-posta adresi kullanın.";
                    }
                    else if (sqlEx.Message.Contains("UNIQUE") || sqlEx.Message.Contains("unique"))
                    {
                        message = "Bu bilgi zaten sistemde mevcut. Lütfen farklı bir değer girin.";
                    }
                    else
                    {
                        message = "Bu bilgi zaten kayıtlı. Lütfen kontrol edip tekrar deneyin.";
                    }
                }
                else
                {
                    message = "Veritabanı hatası: " + sqlEx.Message;
                }
            }

            else if (exception is ArgumentException || exception is ArgumentNullException)
            {
                code = HttpStatusCode.BadRequest;
                message = exception.Message;
            }
            else if (exception is UnauthorizedAccessException)
            {
                code = HttpStatusCode.Unauthorized;
                message = "Yetkiniz bulunmamaktadır.";
            }
            else if (exception is KeyNotFoundException)
            {
                code = HttpStatusCode.NotFound;
                message = "Aranan kayıt bulunamadı.";
            }

            var result = JsonSerializer.Serialize(new
            {
                message = message,
                statusCode = (int)code
            });

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)code;
            return context.Response.WriteAsync(result);
        }
    }
}


