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

        /// <summary>Runs an ADQL query against the "ps" table and returns per-publication measurement rows.</summary>
        Task<List<PlanetMeasurementDto>> FetchMeasurementsAsync(string adqlQuery, CancellationToken cancellationToken = default);
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
            return await QueryAsync<ExoplanetDto>(adqlQuery, cancellationToken);
        }

        public async Task<List<PlanetMeasurementDto>> FetchMeasurementsAsync(string adqlQuery, CancellationToken cancellationToken = default)
        {
            return await QueryAsync<PlanetMeasurementDto>(adqlQuery, cancellationToken);
        }

        private async Task<List<T>> QueryAsync<T>(string adqlQuery, CancellationToken cancellationToken)
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

            var rows = JsonSerializer.Deserialize<List<T>>(jsonString, _jsonOptions);
            return rows ?? new List<T>();
        }
    }
}
