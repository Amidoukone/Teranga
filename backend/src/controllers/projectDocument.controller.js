"use strict";

const { ProjectDocument, Project, User, ProjectPhase } = require("../../models");
const { getLabel } = require("../utils/labels");
const imageKit = require("../helpers/teranga-imagekit");
const path = require("path");

/* =========================================================
   🏷 Types de documents
========================================================= */
const DOCUMENT_KINDS = {
  contract: "Contrat",
  plan: "Plan",
  report: "Rapport",
  photo: "Photo",
  other: "Autre",
};

/* =========================================================
   🛡 ImageKit actif ?
========================================================= */
function isImageKitEnabled() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  );
}

/* =========================================================
   🧩 Helpers généraux ACL + logique
========================================================= */
function isWithinOneHour(date) {
  if (!date) return false;
  const created = new Date(date).getTime();
  return Number.isFinite(created) && Date.now() - created <= 3600000;
}

function isAdmin(user) {
  return user?.role === "admin";
}

function isClientOwner(project, user) {
  return (
    project &&
    user?.role === "client" &&
    String(project.clientId) === String(user.id)
  );
}

function canClientModify(project, user) {
  return (
    isClientOwner(project, user) &&
    isWithinOneHour(project.createdAt)
  );
}

function isAssignedAgent(project, user) {
  return (
    project &&
    user?.role === "agent" &&
    String(project.agentId) === String(user.id)
  );
}

/* =========================================================
   🧰 Extraction fichiers Multer
========================================================= */
function extractFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;

  if (req.files && typeof req.files === "object") {
    const arr = [];
    Object.values(req.files).forEach((v) => {
      if (Array.isArray(v)) arr.push(...v);
    });
    return arr;
  }
  return [];
}

/* =========================================================
   🚀 Upload → ImageKit (sécurisé)
========================================================= */
async function uploadToImageKit(file, projectId) {
  if (!isImageKitEnabled()) {
    console.warn("⚠️ ImageKit désactivé — upload ignoré");
    return { url: null, fileId: null };
  }

  try {
    const uploaded = await imageKit.upload({
      file: file.buffer,
      fileName: `project_${projectId}_${Date.now()}_${file.originalname}`,
      folder: "/teranga/projects/",
    });

    return {
      url: uploaded.url,
      fileId: uploaded.fileId,
    };
  } catch (err) {
    console.error(`❌ Upload ImageKit échoué (${file.originalname}):`, err);
    return { url: null, fileId: null };
  }
}

/* =========================================================
   🔹 UPLOAD documents projet
========================================================= */
exports.upload = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const { projectId, title, kind, notes, phaseId } = req.body;
    const files = extractFiles(req);

    if (!projectId || files.length === 0)
      return res.status(400).json({ error: "projectId et fichiers requis" });

    const project = await Project.findByPk(projectId);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    // ACL
    const adminOK = isAdmin(req.user);
    const clientOK = isClientOwner(project, req.user);
    const agentOK = isAssignedAgent(project, req.user);

    if (!adminOK && !clientOK && !agentOK) {
      return res.status(403).json({
        error: "Non autorisé à ajouter des documents à ce projet.",
      });
    }

    // Phase (optionnelle)
    let phase = null;

    if (phaseId) {
      phase = await ProjectPhase.findByPk(phaseId);
      if (!phase || String(phase.projectId) !== String(project.id)) {
        return res
          .status(400)
          .json({ error: "phaseId invalide pour ce projet" });
      }
    }

    const createdDocs = [];

    /* =========================================================
       🚀 Upload + insert DB
    ========================================================== */
    for (const file of files) {
      const uploaded = await uploadToImageKit(file, projectId);

      const doc = await ProjectDocument.create({
        projectId,
        uploaderId: req.user.id,
        phaseId: phase ? phase.id : null,
        title: title || file.originalname || null,
        kind: kind || "other",
        filePath: uploaded.url,
        fileId: uploaded.fileId,
        mimeType: file.mimetype || null,
        fileSize: file.size ?? null,
        originalName: file.originalname || null,
        notes: notes || null,
      });

      const full = await ProjectDocument.findByPk(doc.id, {
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

      const json = full.toJSON();

      createdDocs.push({
        ...json,
        kindLabel: getLabel(json.kind, DOCUMENT_KINDS),
        phaseTitle: json.phase?.title || null,
        uploaderName:
          `${json.uploader?.firstName || ""} ${
            json.uploader?.lastName || ""
          }`.trim() || json.uploader?.email || null,
      });
    }

    return res.status(201).json({
      message: "Document(s) ajouté(s) avec succès",
      projectId,
      documents: createdDocs,
    });
  } catch (e) {
    console.error("❌ Erreur upload document:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de l'ajout du document" });
  }
};

/* =========================================================
   🔹 LIST documents projet
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

    // ACL lecture
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

    const formatted = docs.map((d) => {
      const json = d.toJSON();
      return {
        ...json,
        kindLabel: getLabel(json.kind, DOCUMENT_KINDS),
        phaseTitle: json.phase?.title || null,
        uploaderName:
          `${json.uploader?.firstName || ""} ${
            json.uploader?.lastName || ""
          }`.trim() || json.uploader?.email || null,
      };
    });

    return res.json({
      projectId,
      documents: formatted,
    });
  } catch (e) {
    console.error("❌ Erreur list documents:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des documents" });
  }
};

/* =========================================================
   🔹 DELETE document projet
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

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Non autorisé à supprimer ce document. Un client ne peut supprimer qu'une heure après création.",
      });
    }

    /* =========================================================
       🗑 Suppression côté ImageKit
    ========================================================== */
    if (doc.fileId && isImageKitEnabled()) {
      try {
        await imageKit.deleteFile(doc.fileId);
      } catch (e) {
        console.warn("⚠️ Suppression ImageKit impossible:", e.message);
      }
    }

    await doc.destroy();

    return res.json({
      message: "Document supprimé avec succès",
      projectId: project.id,
    });
  } catch (e) {
    console.error("❌ Erreur suppression document:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la suppression du document" });
  }
};
