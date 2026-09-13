package com.fixflow.incident;

import java.util.List;
import java.sql.Types;
import com.fixflow.ai.AnalysisController.Analysis;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

// The repository owns SQL; the controller owns HTTP requests and responses.
@Repository
public class IncidentRepository {
    private final JdbcClient jdbc;
    private static final RowMapper<Incident> MAPPER = (row, number) -> new Incident(
            row.getLong("id"), row.getString("description"), row.getString("location"),
            row.getString("status"), row.getTimestamp("created_at").toInstant(), row.getString("assigned_technician"), row.getString("ai_mode"), row.getString("ai_category"),
            row.getString("ai_priority"), row.getString("ai_summary"), row.getString("reviewed_category"),
            row.getString("reviewed_priority"), row.getString("reviewed_summary"), row.getString("reviewed_by"),
            row.getTimestamp("reviewed_at") == null ? null : row.getTimestamp("reviewed_at").toInstant(), row.getString("cause"), row.getString("resolution"),
            row.getTimestamp("resolved_at") == null ? null : row.getTimestamp("resolved_at").toInstant());

    public IncidentRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public List<Incident> findAll(String owner, String role) {
        return jdbc.sql("SELECT * FROM incidents WHERE " + visibility() + " ORDER BY id DESC").param("owner", owner).param("role", role).query(MAPPER).list();
    }

    public Optional<Incident> findById(long id, String owner, String role) {
        return jdbc.sql("SELECT * FROM incidents WHERE id = :id AND " + visibility())
                .param("id", id).param("owner", owner).param("role", role).query(MAPPER).optional();
    }

    public Incident create(String description, String location, String owner, Analysis analysis) {
        // Bound parameters keep user input separate from SQL.
        return jdbc.sql("""
                INSERT INTO incidents (description, location, owner_email, ai_mode, ai_category, ai_priority, ai_summary)
                VALUES (:description, :location, :owner, :mode, :category, :priority, :summary) RETURNING *
                """)
                .param("owner", owner).param("description", description).param("location", location)
                .param("mode", analysis == null ? null : analysis.mode(), Types.VARCHAR)
                .param("category", analysis == null ? null : analysis.category(), Types.VARCHAR)
                .param("priority", analysis == null ? null : analysis.priority(), Types.VARCHAR)
                .param("summary", analysis == null ? null : analysis.summary(), Types.VARCHAR)
                .query(MAPPER).single();
    }

    public record PastFix(long id, String description, String cause, String resolution) {}

    public List<PastFix> similarFixes(long id, String technician) {
        // English stemming matches e.g. "disconnecting" and "disconnected".
        // Source and candidates both retain the existing assignment boundary.
        return jdbc.sql("""
            WITH terms AS (
              SELECT unnest(tsvector_to_array(to_tsvector('english', description))) AS term
              FROM incidents WHERE id = :id AND assigned_technician = :technician
            ), search AS (
              SELECT to_tsquery('english', string_agg(quote_literal(term), ' | ')) AS query FROM terms
            )
            SELECT i.id, i.description, i.cause, i.resolution
            FROM incidents i CROSS JOIN search s
            WHERE i.id <> :id AND i.assigned_technician = :technician
              AND i.status = 'RESOLVED'
              AND length(trim(coalesce(i.cause, ''))) > 0
              AND length(trim(coalesce(i.resolution, ''))) > 0
              AND to_tsvector('english', i.description) @@ s.query
            ORDER BY ts_rank(to_tsvector('english', i.description), s.query) DESC,
                     i.resolved_at DESC NULLS LAST, i.id DESC
            LIMIT 5
            """).param("id", id).param("technician", technician)
            .query((row, number) -> new PastFix(row.getLong("id"), row.getString("description"),
                row.getString("cause"), row.getString("resolution"))).list();
    }

    public Optional<Incident> review(long id, ReviewRequest review, String reviewer) {
        return jdbc.sql("UPDATE incidents SET reviewed_category = :category, reviewed_priority = :priority, reviewed_summary = :summary, reviewed_by = :reviewer, reviewed_at = CURRENT_TIMESTAMP WHERE id = :id RETURNING *")
            .param("id", id).param("category", review.category().name()).param("priority", review.priority().name())
            .param("summary", review.summary().strip()).param("reviewer", reviewer).query(MAPPER).optional();
    }

    private String visibility() {
        return "(:role = 'ADMIN' OR (:role = 'USER' AND owner_email = :owner) OR (:role = 'TECHNICIAN' AND assigned_technician = :owner))";
    }

    public Optional<Incident> assign(long id, String technician) {
        return jdbc.sql("UPDATE incidents SET assigned_technician = :technician WHERE id = :id AND EXISTS (SELECT 1 FROM app_users WHERE email = :technician AND role = 'TECHNICIAN') RETURNING *")
            .param("id", id).param("technician", technician).query(MAPPER).optional();
    }

    public Optional<Incident> updateStatus(long id, UpdateIncidentStatusRequest request, String owner) {
        return jdbc.sql("""
                UPDATE incidents SET
                  cause = CASE WHEN :status = 'RESOLVED' THEN :cause ELSE cause END,
                  resolution = CASE WHEN :status = 'RESOLVED' THEN :resolution ELSE resolution END,
                  resolved_at = CASE WHEN :status = 'RESOLVED' THEN
                    CASE WHEN status = 'RESOLVED' THEN COALESCE(resolved_at, CURRENT_TIMESTAMP)
                         ELSE CURRENT_TIMESTAMP END ELSE resolved_at END,
                  status = :status
                WHERE id = :id AND assigned_technician = :owner RETURNING *
                """)
                .param("status", request.status().name())
                .param("cause", request.cause() == null ? null : request.cause().strip(), Types.VARCHAR)
                .param("resolution", request.resolution() == null ? null : request.resolution().strip(), Types.VARCHAR)
                .param("id", id).param("owner", owner).query(MAPPER).optional();
    }
}
