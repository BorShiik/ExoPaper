using Microsoft.AspNetCore.JsonPatch.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Metadata;
using System.Text;
using System.Threading.Tasks;

namespace ExoPaperRAG.Infrastructure.Services
{
    public class AdqlQueryBuilder
    {
        private readonly List<string> _selectColumns = new();
        private string? _fromTable;
        private readonly List<string> _whereConditions = new();
        private string? _orderBy;
        private int? _top;

        public AdqlQueryBuilder Select(params string[] columns)
        {
            _selectColumns.AddRange(columns);
            return this;
        }

        public AdqlQueryBuilder From(string table)
        {
            _fromTable = table;
            return this;
        }

        public AdqlQueryBuilder Top(int count)
        {
            _top = count;
            return this;
        }

        public AdqlQueryBuilder Where(string column, string op, object value)
        {
            string formattedValue = value is string s ? $"'{s}'" : value?.ToString()?.Replace(',', '.') ?? "NULL";  
            _whereConditions.Add($"{column} {op} {formattedValue}");
            return this;
        }

        public AdqlQueryBuilder WhereNotNull(string column)
        {
            _whereConditions.Add($"{column} IS NOT NULL");
            return this;
        }

        public AdqlQueryBuilder OrderBy(string column, bool ascending = true)
        {
            _orderBy = $"{column} {(ascending ? "ASC" : "DESC")}";
            return this;
        }

        public string Build()
        {
            if (string.IsNullOrEmpty( _fromTable))
                throw new InvalidOperationException("Table (FROM) must be specified.");

            var selectPart = _selectColumns.Count > 0 ? string.Join(",", _selectColumns) : "*";
            var topPart = _top.HasValue ? $"TOP {_top} " : "";

            var query = $"SELECT {topPart}{selectPart} From {_fromTable}";

            if (_whereConditions.Count > 0)
            {
                query += " WHERE " + string.Join(" AND ", _whereConditions);
            }

            if (!string.IsNullOrEmpty(_orderBy))
            {
                query += " ORDER BY " + _orderBy;
            }

            return query;
        }
    }
}
