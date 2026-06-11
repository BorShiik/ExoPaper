# Introduction to the ExoPaper Project

## About the Project

**ExoPaper** is an advanced web application (a Retrieval-Augmented Generation, or RAG, platform) designed for exploring, analyzing, and visualizing data about exoplanets. The project combines raw astronomical data retrieved from the NASA Exoplanet Archive with the latest scientific publications from the arXiv repository. It then utilizes local Artificial Intelligence (LLM) models to generate readable, comprehensive summaries.

The primary goal of the system is to make knowledge about exoplanets highly accessible. Instead of digging through raw tables of physical parameters or complex research papers, users are provided with accessible summaries, 3D visual representations of celestial bodies, and the ability to ask an AI assistant natural language questions.

## Core Features

1. **Exoplanet Catalog (NASA Synchronization):**
   - The system automatically (in the background) retrieves the latest information about discovered exoplanets using the TAP (Table Access Protocol) from the NASA archive.
   - Users have access to an interactive planet list, with filtering (e.g., by discovery method, HWO candidate status) and sorting capabilities.

2. **arXiv Integration (Scientific Publications):**
   - The application searches the arXiv repository for scientific articles mentioning a specific exoplanet.
   - The publications are saved to the database, and their abstracts serve as a knowledge base (context) for the local Artificial Intelligence.

3. **Local Artificial Intelligence (Ollama):**
   - The system does not rely on external, paid APIs (such as OpenAI). Instead, it uses a locally hosted **Ollama** engine with open-source language models (e.g., `llama3.2:3b` for text generation and `nomic-embed-text` for vector embeddings).
   - The AI models generate physical property summaries, assess potential habitability, and enable conversational chat features (answering questions based on assigned scientific papers).

4. **Vector Search (Semantic Search):**
   - Thanks to the RavenDB database, publication abstracts are vectorized. This enables semantic search capabilities—when a user asks a question, the system finds the most semantically relevant text fragments, which the AI then uses to formulate an answer.

5. **3D Visualization:**
   - The user interface features an interactive, three-dimensional model of the planet and its host star, built using the Three.js library (via React Three Fiber).

6. **On-the-fly Translation (LibreTranslate):**
   - Content fetched from English sources (NASA, arXiv, as well as AI-generated answers) is dynamically translated into Polish using the integrated, local **LibreTranslate** engine.

## Target Audience
The application is aimed at astronomy enthusiasts, students, researchers, and anyone curious about the cosmos who seeks aggregated, easily digestible information regarding newly discovered worlds.
