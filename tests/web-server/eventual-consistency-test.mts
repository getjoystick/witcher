import type { Express } from "express";
export function defineEventualConsistencyRoutes(app: Express) {
  const todos = [
    {
      id: 1,
      title: "Answer to the Ultimate Question of Life, the Universe, and Everything",
    },
    {
      id: 2,
      title: "Buy milk",
    },
  ];

  app.get("/api/eventual-consistency/todo", (req, res) => {
    res.json({ todos });
  });

  app.get("/api/eventual-consistency/todo/:id", (req, res) => {
    const todo = todos.find((todo) => todo.id === Number(req.params.id));

    if (!todo) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ todo });
  });

  app.post("/api/eventual-consistency/todo", (req, res) => {
    const newTodo = {
      id: todos.reduce((curr, prev) => Math.max(curr, prev.id), 0) + 1,
      title: req.body.title,
    };

    setTimeout(() => {
      todos.push(newTodo);
    }, 1000);
    res.json({ newTodo });
  });
}
