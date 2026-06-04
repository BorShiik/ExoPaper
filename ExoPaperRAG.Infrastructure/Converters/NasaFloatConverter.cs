using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ExoPaperRAG.Infrastructure.Converters
{
    public class NasaFloatConverter : JsonConverter<double?>
    {
        public override double? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
                return null;

            if (reader.TokenType == JsonTokenType.Number)
            {
                return reader.GetDouble();
            }

            if (reader.TokenType == JsonTokenType.String)
            {
                var stringValue = reader.GetString();
                if (string.IsNullOrWhiteSpace(stringValue))
                    return null;

                // Handle missing leading zero, e.g. ".85" -> "0.85", "-.85" -> "-0.85"
                if (stringValue.StartsWith("."))
                    stringValue = "0" + stringValue;
                else if (stringValue.StartsWith("-."))
                    stringValue = "-0." + stringValue.Substring(2);

                if (double.TryParse(stringValue, NumberStyles.Any, CultureInfo.InvariantCulture, out double parsedValue))
                {
                    return parsedValue;
                }
                
                // Return null or throw depending on strictness. Let's be lenient.
                return null;
            }

            throw new JsonException($"Unexpected token parsing double: {reader.TokenType}");
        }

        public override void Write(Utf8JsonWriter writer, double? value, JsonSerializerOptions options)
        {
            if (value.HasValue)
            {
                writer.WriteNumberValue(value.Value);
            }
            else
            {
                writer.WriteNullValue();
            }
        }
    }
}
