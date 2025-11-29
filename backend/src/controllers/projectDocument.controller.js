"use strict";

const path = require("path");
const { ProjectDocument, Project, User, ProjectPhase } = require("../../models");
const { getLabel } = require("../utils/labels");
const imagekit = require("../helpers/teranga-imagekit"); // ⚠️ ton helper ImageKit

const DOCUMENT_KINDS = {
  contract: "Contrat",
  plan: "Plan",
  report: "Rapport",
  photo: "Photo",
  other: "Autre",
};

/* =========================================================
   🧩 Helpers autorisation & cohérence
========================================================= */
function isWithinOneHour(date) {
  if (!date) return false;
  const created = new Date(date).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 3600000;
}

function canClientModify(project, user) {
  return (
    user.role === "client" &&
    project.clientId === user.id &&
    isWithinOneHour(project.createdAt)
  );
}

function isAdmin(user) {
  return user?.role === "admin";
}

function isClientOwner(project, user) {
  return !!(
    project &&
    user &&
    user.role === "client" &&
    project.clientId === user.id
  );
}

function isAssignedAgent(project, user) {
  return !!(
    project &&
    user &&
    user.role === "agent" &&
    project.agentId === user.id
  );
}

/* =========================================================
   🔹 Upload d’un ou plusieurs documents (ImageKit)
========================================================= */
exports.upload = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const { projectId, title, kind, notes, phaseId } = req.body;
    const files = req.files || (req.file ? [req.file] : []);

    if (!projectId || files.length === 0)
      return res
        .status(400)
        .json({ error: "projectId et fichiers requis" });

    const project = await Project.findByPk(projectId);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    const adminOK = isAdmin(req.user);
    const clientOK = isClientOwner(project, req.user);
    const agentOK = isAssignedAgent(project, req.user);

    if (!adminOK && !clientOK && !agentOK) {
      return res.status(403).json({
        error: "Non autorisé à ajouter des documents sur ce projet.",
      });
    }

    // Phase optionnelle
    let phase = null;
    if (phaseId) {
      phase = await ProjectPhase.findByPk(phaseId);
      if (!phase || String(phase.projectId) !== String(project.id)) {
        return res
          .status(400)
          .json({ error: "phaseId invalide pour ce projet" });
      }
    }

    /* =========================================================
       🚀 Upload → ImageKit
    ========================================================== */
    const createdDocs = [];

    for (const file of files) {
      // Upload dans ImageKit
      const uploaded = await imagekit.upload({
        file: file.buffer, // buffer venant de Multer memoryStorage
        fileName: `project_${projectId}_${Date.now()}_${file.originalname}`,
        folder: "/teranga/projects/",
      });

      // Enregistrement DB
      const doc = await ProjectDocument.create({
        projectId,
        uploaderId: req.user.id,
        phaseId: phase ? phase.id : null,
        title: title || file.originalname || null,
        kind: kind || "other",
        filePath: uploaded.url, // ⚠️ URL CDN ImageKit
        fileId: uploaded.fileId, // ⚠️ pour suppression future
        mimeType: file.mimetype || null,
        fileSize: file.size ?? null,
        originalName: file.originalname || null,
        notes: notes || null,
      });

      const created = await ProjectDocument.findByPk(doc.id, {
        include: [
          {
            model: User,
            as: "uploader",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: ProjectPhase,
            as: "phase",
            attributes: ["id", "title"],
          },
        ],
      });

      createdDocs.push({
        ...created.toJSON(),
        kindLabel: getLabel(created.kind, DOCUMENT_KINDS),
        phaseTitle: created?.phase?.title || null,
      });
    }

    res.status(201).json({
      message: "Document(s) ajouté(s) avec succès",
      projectId,
      documents: createdDocs,
    });
  } catch (e) {
    console.error("❌ Erreur upload document:", e);
    res
      .status(500)
      .json({ error: "Erreur lors de l'ajout du document" });
  }
};

/* =========================================================
   🔹 Liste des documents d’un projet
========================================================= */
exports.listByProject = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const projectId = req.query.projectId || req.params.projectId;
    if (!projectId)
      return res.status(400).json({ error: "projectId requis" });

    const project = await Project.findByPk(projectId, {
      attributes: ["id", "clientId", "agentId"],
    });
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    if (!isAdmin(req.user)) {
      if (req.user.role === "client" && project.clientId !== req.user.id)
        return res.status(403).json({ error: "Accès non autorisé" });

      if (req.user.role === "agent" && project.agentId !== req.user.id)
        return res.status(403).json({ error: "Accès non autorisé" });
    }

    const docs = await ProjectDocument.findAll({
      where: { projectId },
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: ProjectPhase,
          as: "phase",
          attributes: ["id", "title"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      projectId,
      documents: docs.map((d) => ({
        ...d.toJSON(),
        kindLabel: getLabel(d.kind, DOCUMENT_KINDS),
        phaseTitle: d?.phase?.title || null,
      })),
    });
  } catch (e) {
    console.error("❌ Erreur list documents:", e);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des documents" });
  }
};

/* =========================================================
   🔹 Suppression d’un document (ImageKit)
========================================================= */
exports.remove = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const doc = await ProjectDocument.findByPk(req.params.id);
    if (!doc)
      return res.status(404).json({ error: "Document introuvable" });

    const project = await Project.findByPk(doc.projectId);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientModify(project, req.user);
    if (!adminOK && !clientOK)
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent supprimer un document que dans l'heure suivant la création du projet.",
      });

    /* =========================================================
       🗑️ Suppression ImageKit
    ========================================================== */
    if (doc.fileId) {
      try {
        await imagekit.deleteFile(doc.fileId);
      } catch (e) {
        console.warn("⚠️ Impossible de supprimer le fichier ImageKit:", e.message);
      }
    }

    await doc.destroy();

    res.json({
      message: "Document supprimé avec succès",
      projectId: project.id,
    });
  } catch (e) {
    console.error("❌ Erreur suppression document:", e);
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression du document" });
  }
};
