# 📚 Next.js Workflow Visualization - Complete Index

## 🎯 Цель проекта

Полнофункциональный пример Next.js 15.0.5 приложения с серверными actions для запуска workflow и React Flow визуализацией с OpenTelemetry интеграцией.

## 📖 Документация

### Начало работы
1. **[QUICKSTART.md](./QUICKSTART.md)** ⭐ **НАЧНИТЕ ЗДЕСЬ!**
   - Установка за 60 секунд
   - Первые шаги
   - Примеры использования
   - Troubleshooting

2. **[README.md](./README.md)** 
   - Полное описание проекта
   - Структура файлов
   - Технологии
   - Расширение функционала

### Архитектура и дизайн
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)**
   - Диаграммы архитектуры
   - Data flow
   - Component hierarchy
   - Integration points

4. **[EXAMPLE.md](./EXAMPLE.md)**
   - Детальное объяснение
   - Ключевые особенности
   - Production-ready features
   - Интеграция с основным проектом

## 🗂️ Структура файлов

### Configuration Files
```
package.json          → Dependencies (Next.js 15, React 19, React Flow)
tsconfig.json         → TypeScript configuration
next.config.ts        → Next.js configuration
tailwind.config.ts    → Tailwind CSS configuration
postcss.config.mjs    → PostCSS configuration
.eslintrc.json        → ESLint configuration
.gitignore            → Git ignore patterns
```

### Source Code

#### Application Layer (`src/app/`)
```
page.tsx              → Main page component (Client)
                        - Workflow selector
                        - Execute button
                        - Tab navigation
                        - Results display

layout.tsx            → Root layout component
                        - HTML structure
                        - Global metadata

actions.ts            → Server Actions ⚡
                        - executeWorkflowAction()
                        - getAvailableWorkflows()
                        - getWorkflowDefinition()

globals.css           → Global styles and Tailwind imports
```

#### Components (`src/components/`)
```
WorkflowVisualizer.tsx → React Flow visualization 📊
                         - Node rendering
                         - Edge connections
                         - Animation
                         - MiniMap & Controls

TraceViewer.tsx        → OpenTelemetry trace viewer 🔍
                         - Timeline visualization
                         - Span details
                         - Statistics
```

#### Library (`src/lib/workflow/`)
```
types.ts              → TypeScript type definitions
                        - WorkflowDefinition
                        - WorkflowNode
                        - WorkflowExecutionResult
                        - TraceSpan

runtime.ts            → Workflow execution engine
                        - executeWorkflow()
                        - executeNode()
                        - TraceCollector
                        - Mock procedures

examples.ts           → Example workflow definitions
                        - mathWorkflow
                        - conditionalWorkflow
                        - parallelWorkflow
                        - complexWorkflow
```

## 🎨 Component Overview

### Page Component
```typescript
Main orchestrator
├─ Workflow selection dropdown
├─ Execute button with loading state
├─ Execution status display
├─ Tab navigation (Graph / Trace)
├─ WorkflowVisualizer (conditional render)
├─ TraceViewer (conditional render)
└─ Workflow details table
```

### WorkflowVisualizer
```typescript
React Flow integration
├─ Auto-generate nodes from workflow
├─ Auto-generate edges from connections
├─ Color-code by node type
├─ Animate executed nodes
├─ Display execution time
└─ Interactive controls (zoom, pan, minimap)
```

### TraceViewer
```typescript
OpenTelemetry visualization
├─ Timeline with relative positioning
├─ Span hierarchy display
├─ Expandable span details
│  ├─ Attributes
│  ├─ Events
│  └─ Status
└─ Summary statistics
```

## 🔄 Workflow Examples

### 1. Math Calculation Workflow
**File**: `src/lib/workflow/examples.ts:mathWorkflow`
```
Purpose: Demonstrates sequential execution
Nodes: 3
Type: Sequential
Execution time: ~1.5s
```

### 2. Conditional Processing Workflow
**File**: `src/lib/workflow/examples.ts:conditionalWorkflow`
```
Purpose: Demonstrates conditional branching
Nodes: 5
Type: Conditional
Execution time: ~2.5s
```

### 3. Parallel Tasks Workflow
**File**: `src/lib/workflow/examples.ts:parallelWorkflow`
```
Purpose: Demonstrates parallel execution
Nodes: 4
Type: Parallel
Execution time: ~1.0s
```

### 4. Complex Workflow
**File**: `src/lib/workflow/examples.ts:complexWorkflow`
```
Purpose: Combines all patterns
Nodes: 8
Type: Mixed
Execution time: ~3.5s
```

## 🔧 Key Technologies

### Frontend
- **Next.js 15.0.5** - React framework with App Router
- **React 19** - UI library
- **React Flow 12** - Graph visualization
- **Tailwind CSS 3.4** - Utility-first CSS

### Backend
- **Server Actions** - Type-safe RPC
- **OpenTelemetry API 1.9** - Tracing and metrics
- **Zod 3.23** - Schema validation

### Development
- **TypeScript 5** - Type safety
- **ESLint** - Code linting
- **PostCSS** - CSS processing

## 📊 Data Flow

```
1. User selects workflow
   ↓
2. User clicks "Execute"
   ↓
3. Client calls Server Action
   ↓
4. Server executes workflow with tracing
   ↓
5. Server returns result with spans
   ↓
6. Client updates state
   ↓
7. React re-renders UI with new data
   ↓
8. WorkflowVisualizer shows animated graph
   TraceViewer shows timeline
```

## 🎯 Features Checklist

### ✅ Implemented
- [x] Next.js 15 App Router
- [x] Server Actions integration
- [x] Workflow execution engine
- [x] OpenTelemetry tracing
- [x] React Flow visualization
- [x] Trace timeline viewer
- [x] 4 example workflows
- [x] Interactive UI
- [x] Type-safe end-to-end
- [x] Responsive design
- [x] Comprehensive documentation

### 🔮 Future Enhancements (Optional)
- [ ] Authentication
- [ ] Database persistence
- [ ] Real-time streaming
- [ ] Webhook notifications
- [ ] Custom node types
- [ ] Export to JSON/YAML
- [ ] Import workflows
- [ ] Workflow history
- [ ] Performance metrics
- [ ] Error recovery

## 📝 Quick Commands

```bash
# Installation
npm install

# Development
npm run dev          # Start dev server on :3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## 🚀 Getting Started (30 seconds)

```bash
cd examples/nextjs-workflow-viz
npm install
npm run dev
# Open http://localhost:3000
```

## 📚 Learning Path

### Beginner
1. Read [QUICKSTART.md](./QUICKSTART.md)
2. Run the example
3. Try each workflow
4. Explore the UI

### Intermediate
1. Read [README.md](./README.md)
2. Study [EXAMPLE.md](./EXAMPLE.md)
3. Modify existing workflows
4. Add custom procedures

### Advanced
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Integrate with main project
3. Add real database
4. Deploy to production

## 🔗 External Resources

### Official Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [React Flow Docs](https://reactflow.dev/)
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Related Guides
- [Server Actions Guide](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React 19 Features](https://react.dev/blog/2024/04/25/react-19)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🆘 Support

### Common Issues

**Issue**: Port 3000 already in use
```bash
Solution: PORT=3001 npm run dev
```

**Issue**: Module not found
```bash
Solution: rm -rf node_modules && npm install
```

**Issue**: Build errors
```bash
Solution: npm run lint
```

### Getting Help
1. Check [QUICKSTART.md](./QUICKSTART.md) Troubleshooting
2. Read error messages carefully
3. Check browser console (F12)
4. Review relevant documentation file

## 📈 Project Statistics

```
Total Files: 25+
Lines of Code: ~2000+
Components: 3
Server Actions: 3
Example Workflows: 4
Mock Procedures: 6
Documentation Pages: 7
```

## 🎉 Success Criteria

You'll know the example is working when:

✅ Dev server starts without errors  
✅ Page loads at http://localhost:3000  
✅ Workflow dropdown shows 4 options  
✅ Execute button triggers workflow  
✅ Graph shows animated nodes  
✅ Trace viewer displays spans  
✅ Statistics are correct  

## 🏆 What You'll Learn

After working with this example:

1. **Next.js 15 Features**
   - App Router
   - Server Actions
   - Client/Server boundaries

2. **Workflow Systems**
   - Node types and execution
   - Sequential vs parallel
   - Conditional branching

3. **OpenTelemetry**
   - Span creation
   - Trace collection
   - Visualization

4. **React Flow**
   - Graph visualization
   - Node customization
   - Interactive controls

5. **TypeScript**
   - End-to-end types
   - Type inference
   - Generic types

## 🎓 Next Steps

1. ✅ Complete setup and run
2. 📖 Read all documentation
3. 🔧 Modify examples
4. 🎨 Customize UI
5. 🚀 Build your own workflows

---

**Ready to start?** → [QUICKSTART.md](./QUICKSTART.md) ⭐
