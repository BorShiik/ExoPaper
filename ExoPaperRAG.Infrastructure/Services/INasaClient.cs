using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json;
using ExoPaperRAG.Infrastructure.Models;
using ExoPaperRAG.Infrastructure.Settings;
using Microsoft.Extensions.Options;

namespace ExoPaperRAG.Infrastructure.Services
{
    public interface INasaClient
    {
        Task<List<ExoplanetDto>> FetchPlanetAcync(string adqlQuery, CancellationToken cancellationToken = default) ;
    }

    public class NasaClient : INasaClient
    {
        private readonly HttpClient _httpClient;
        private readonly JsonSerializerOptions _jsonOptions;

        public NasaClient(HttpClient httpClient, IOptions<NasaApiSettings> options)
        {
            _httpClient = httpClient;
            _httpClient.BaseAddress = new Uri(options.Value.BaseUrl);

            _jsonOptions = new JsonSerializerOptions() { PropertyNameCaseInsensitive = true };
            _jsonOptions.Converters.Add(new Converters.NasaFloatConverter());
        }
        public async Task<List<ExoplanetDto>> FetchPlanetAcync(string adqlQuery, CancellationToken cancellationToken = default)
        {
            var requestData = new[]
            {
                new KeyValuePair<string, string>("REQUEST", "doQuery"),
                new KeyValuePair<string, string>("LANG", "ADQL"),
                new KeyValuePair<string, string>("FORMAT", "json"),
                new KeyValuePair<string, string>("QUERY", adqlQuery)
            };

            var content = new FormUrlEncodedContent(requestData);

            var response = await _httpClient.PostAsync("TAP/sync", content, cancellationToken);

            response.EnsureSuccessStatusCode();

            var jsonString = await response.Content.ReadAsStringAsync(cancellationToken);

            var planets = JsonSerializer.Deserialize<List<ExoplanetDto>>(jsonString, _jsonOptions);
            return planets ?? new List<ExoplanetDto>();

        }
    }
}
