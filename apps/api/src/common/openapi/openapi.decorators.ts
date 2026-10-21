import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse, type SchemaObject } from '@nestjs/swagger';
import { ERROR_HTTP_STATUS, ErrorCode } from '@offerleap/shared';
import { z } from 'zod';

/**
 * @description Converts a Zod schema to an OpenAPI 3.0 schema, so request/response docs come from the same
 * schemas the API validates with (no hand-written DTO classes that can drift).
 * @param schema - Zod schema.
 * @param io - `input` for request bodies (before transforms), `output` for responses.
 * @returns OpenAPI schema object.
 */
function toOpenApiSchema(schema: z.ZodType, io: 'input' | 'output'): SchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io, unrepresentable: 'any' }) as SchemaObject;
}

const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.enum(Object.values(ErrorCode)),
  message: z.string().describe('Developer-facing hint. Never shown to users.'),
  fieldErrors: z
    .array(
      z.object({
        field: z.string(),
        rule: z.string(),
        params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      }),
    )
    .optional(),
  requestId: z.string().optional(),
});

/** Documents the request body with a shared Zod schema. */
export const ApiZodBody = (schema: z.ZodType) => ApiBody({ schema: toOpenApiSchema(schema, 'input') });

/** Documents a success response with a shared Zod schema. */
export const ApiZodResponse = (status: number, schema: z.ZodType, description: string) =>
  ApiResponse({ status, description, schema: toOpenApiSchema(schema, 'output') });

/**
 * @description Documents which error codes an endpoint can return, grouped by HTTP status.
 * @param codes - Error codes the endpoint may answer with.
 */
export function ApiErrors(...codes: ErrorCode[]) {
  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const status = ERROR_HTTP_STATUS[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  return applyDecorators(
    ...[...byStatus].map(([status, statusCodes]) =>
      ApiResponse({
        status,
        description: statusCodes.map((code) => `\`${code}\``).join(', '),
        schema: toOpenApiSchema(errorResponseSchema, 'output'),
      }),
    ),
  );
}
