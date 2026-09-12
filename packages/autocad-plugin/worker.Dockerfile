FROM mcr.microsoft.com/dotnet/sdk:8.0 AS compile
WORKDIR /src
COPY packages/autocad-plugin/Archon.AutoCAD.csproj packages/autocad-plugin/Commands.cs packages/autocad-plugin/InputContract.cs ./
RUN dotnet build Archon.AutoCAD.csproj -c Release -o /compiled

FROM python:3.12-slim AS bundle
WORKDIR /src
COPY packages/autocad-plugin/package_bundle.py packages/autocad-plugin/PackageContents.xml ./
COPY --from=compile /compiled/Archon.AutoCAD.dll /compiled/Archon.AutoCAD.dll
RUN python package_bundle.py /compiled/Archon.AutoCAD.dll

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=bundle /src/artifacts ./packages/autocad-plugin/artifacts
COPY packages/autocad-plugin/worker.mjs packages/autocad-plugin/provision-resources.mjs packages/autocad-plugin/provision-resources.test.mjs ./packages/autocad-plugin/
COPY packages/engine-adapters/src/aps.ts ./packages/engine-adapters/src/aps.ts
USER node
CMD ["node", "--experimental-transform-types", "packages/autocad-plugin/worker.mjs"]
