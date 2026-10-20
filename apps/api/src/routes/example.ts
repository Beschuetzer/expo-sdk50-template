import type { ExampleDocumentResponse } from '@expo-50sdk-template/shared-types';
import type { NextFunction, Request, Response } from 'express';
import { randomInt, randomUUID } from 'node:crypto';

import { prisma } from '../lib/prisma';

const exampleNames = [
  'Morgan Ellis',
  'Casey Rowan',
  'Taylor Quinn',
  'Riley Morgan',
];

type ExampleRecord = {
  id: string;
  name: string;
  email: string | null;
  createdAt: Date;
};

export type ExampleDatabase = {
  example: {
    create(args: {
      data: { name: string; email: string };
    }): Promise<ExampleRecord>;
  };
};

export function createExampleRoute(database: ExampleDatabase = prisma) {
  return async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const example = await database.example.create({
        data: {
          name: exampleNames[randomInt(exampleNames.length)],
          email: `example-${randomUUID()}@example.com`,
        },
      });
      const result: ExampleDocumentResponse = {
        id: example.id,
        name: example.name,
        email: example.email ?? '',
        createdAt: example.createdAt.toISOString(),
      };

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
