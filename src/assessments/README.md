# Assessments

Corrección determinística de ejercicios. La cascada no usa IA ni servicios
externos: normaliza, compara y corta en el primer acierto. La plantilla se lee
de MongoDB y cada ejercicio se prepara una sola vez por versión de contenido.

## Endpoints

Todos requieren sesión iniciada (`SessionAuthGuard`).

### `POST /api/assessments/grade`

Corrige todas las respuestas de una lección en un solo request.

```json
{
  "templateId": "uuid-de-la-plantilla",
  "answers": [
    {
      "componentId": "componente-1",
      "answer": {
        "optionIds": [],
        "text": "Mercurio",
        "blanks": [],
        "order": [],
        "matches": {}
      }
    }
  ]
}
```

El backend busca cada `componentId` en el contenido de la plantilla. Un alumno
debe estar inscripto en al menos una publicación publicada de esa plantilla; el
docente dueño siempre puede corregir.

Respuesta:

```json
{
  "templateId": "uuid-de-la-plantilla",
  "version": "2026-11-20T12:00:00.000Z",
  "total": 1,
  "correct": 1,
  "incorrect": 0,
  "review": 0,
  "score": 1,
  "elapsedMs": 0.042,
  "results": [
    {
      "componentId": "componente-1",
      "result": {
        "status": "correct",
        "score": 1,
        "message": "Coincide con la respuesta esperada.",
        "expected": [],
        "step": "exact"
      }
    }
  ]
}
```

### `POST /api/assessments/preview`

Vista previa del docente con el mismo criterio que un intento real. No escribe
nada en la base.

```json
{
  "component": { "id": "componente-1", "type": "exercise", "exerciseType": "short", "answer": "Mercurio" },
  "answer": { "text": "mercurio" }
}
```

### `POST /api/assessments/prepare`

Precalienta el caché de una plantilla (por ejemplo, al publicar). Solo el
docente dueño.

```json
{ "templateId": "uuid-de-la-plantilla" }
```

## Reglas y umbrales

### Respuesta corta (`short`)

Alternativas separadas por `;` (también se tolera `|`):

```text
Mercurio; Mercurio (planeta); el planeta más cercano al Sol
```

1. Normalización: NFD sin tildes, minúsculas, sin signos, espacios simples.
2. Igualdad normalizada.
3. Conjunto de palabras sin stopwords, con singular simple (`-s`, `-es`,
   `-ces` → `-z`). Los conjuntos deben ser **iguales**; el orden no importa.
4. Levenshtein acotado con cupo según el largo de la alternativa:
   `≤5 → 0`, `≤9 → 1`, resto `→ 2`; además se exige similitud `≥ 0.85`.

### Numérica (`numeric`)

Acepta `1.234,5`, `1,234.5`, `-3`, `3/4` y espacios como separador de miles.
Aprueba con `|diferencia| ≤ max(tolerancia, 1% del valor esperado)`.

### Desarrollo (`essay`)

Conceptos separados por `;`; sinónimos dentro de un grupo por `|`:

```text
fotosíntesis|síntesis clorofílica; clorofila
```

- `minWords` es un mínimo duro: por debajo, la respuesta es incorrecta.
- `forbiddenConcepts` (opcional, `;`) anula la respuesta si aparece.
- Solo se informa cobertura y se devuelve `review`: **nunca** `correct`
  automático. La cobertura `≥ 0.7` se reporta como suficiente para revisión.

### Tipos cerrados

Opción múltiple, varias correctas, verdadero/falso, completar, ordenar y
emparejar se corrigen por comparación directa de ids, con puntaje parcial donde
corresponde.

## Rendimiento

`PreparedExerciseCache` guarda cada ejercicio con clave
`componentId:templateVersion`. La versión sale de `updatedAt` del documento de
contenido, así que una edición invalida el caché sin purgas manuales. La
corrección de un intento queda en comparaciones de strings.

## Tests

```bash
npm run test:grading
```

Usa `node:test` y `ts-node` (ya presentes en `devDependencies`); no agrega
dependencias nuevas.
